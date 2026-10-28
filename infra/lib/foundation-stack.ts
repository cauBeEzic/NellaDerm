import {
  Aws,
  CfnParameter,
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

type MyEczemaFoundationStackProps = StackProps & {
  deploymentMode: 'power-user' | 'standard';
  environmentName: 'demo' | 'production';
};

const tableDomains = [
  'identity',
  'care',
  'media',
  'chat',
  'commerce',
  'operations',
] as const;

const budgetThresholdsUsd = [50, 100, 250] as const;

const healthHandlerCode = `
'use strict';

exports.handler = async () => ({
  statusCode: 200,
  headers: {
    'cache-control': 'no-store',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ status: 'ok', service: 'myeczema-api' }),
});
`;

export class MyEczemaFoundationStack extends Stack {
  constructor(scope: Construct, id: string, props: MyEczemaFoundationStackProps) {
    super(scope, id, props);

    if (props.environmentName === 'production' && props.deploymentMode !== 'standard') {
      throw new Error('Production requires the standard IAM-enabled deployment mode');
    }

    const hasStandardIam = props.deploymentMode === 'standard';

    Tags.of(this).add('Application', 'MyEczema');
    Tags.of(this).add('Environment', props.environmentName);
    Tags.of(this).add('ManagedBy', 'AWS-CDK');
    Tags.of(this).add('DataRegion', 'Canada');

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `myeczema-${props.environmentName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireDigits: false,
        requireLowercase: false,
        requireSymbols: false,
        requireUppercase: false,
        tempPasswordValidity: Duration.days(7),
      },
      deletionProtection: props.environmentName === 'production',
      removalPolicy: props.environmentName === 'production'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    });

    const createMobileClient = (platform: 'ios' | 'android') => userPool.addClient(
      `${platform}Client`,
      {
        userPoolClientName: `myeczema-${props.environmentName}-${platform}`,
        generateSecret: false,
        authFlows: { userSrp: true },
        accessTokenValidity: Duration.hours(1),
        idTokenValidity: Duration.hours(1),
        refreshTokenValidity: Duration.days(30),
        enableTokenRevocation: true,
        preventUserExistenceErrors: true,
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
          callbackUrls: ['myeczema://auth/callback'],
          logoutUrls: ['myeczema://auth/sign-out'],
        },
      },
    );

    const iosClient = createMobileClient('ios');
    const androidClient = createMobileClient('android');

    const dataKey = new kms.Key(this, 'DataKey', {
      alias: `alias/myeczema-${props.environmentName}-data`,
      description: `MyEczema ${props.environmentName} data encryption`,
      enableKeyRotation: true,
      removalPolicy: props.environmentName === 'production'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    });

    const mediaBucket = new s3.Bucket(this, 'PrivateMediaBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dataKey,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: props.environmentName === 'production'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environmentName !== 'production' && hasStandardIam,
      versioned: true,
      lifecycleRules: [
        {
          id: 'expire-incomplete-uploads',
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
        {
          id: 'expire-temporary-exports',
          prefix: 'exports/',
          expiration: Duration.days(1),
          noncurrentVersionExpiration: Duration.days(7),
        },
        {
          id: 'expire-quarantine',
          prefix: 'quarantine/',
          expiration: Duration.days(30),
        },
      ],
    });

    let healthFunction: lambda.Function | undefined;
    let apiDeployOptions: apigateway.StageOptions;

    if (hasStandardIam) {
      const apiAccessLogs = new logs.LogGroup(this, 'ApiAccessLogs', {
        logGroupName: `/aws/apigateway/myeczema-${props.environmentName}`,
        encryptionKey: dataKey,
        retention: props.environmentName === 'production'
          ? logs.RetentionDays.ONE_YEAR
          : logs.RetentionDays.ONE_MONTH,
        removalPolicy: props.environmentName === 'production'
          ? RemovalPolicy.RETAIN
          : RemovalPolicy.DESTROY,
      });

      const healthFunctionLogs = new logs.LogGroup(this, 'HealthFunctionLogs', {
        logGroupName: `/aws/lambda/myeczema-${props.environmentName}-health`,
        encryptionKey: dataKey,
        retention: props.environmentName === 'production'
          ? logs.RetentionDays.ONE_YEAR
          : logs.RetentionDays.ONE_MONTH,
        removalPolicy: props.environmentName === 'production'
          ? RemovalPolicy.RETAIN
          : RemovalPolicy.DESTROY,
      });

      healthFunction = new lambda.Function(this, 'HealthFunction', {
        functionName: `myeczema-${props.environmentName}-health`,
        description: 'Payload-free readiness endpoint for MyEczema',
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(healthHandlerCode),
        logGroup: healthFunctionLogs,
        loggingFormat: lambda.LoggingFormat.JSON,
        memorySize: 128,
        reservedConcurrentExecutions: props.environmentName === 'production' ? 20 : 5,
        timeout: Duration.seconds(3),
        environment: {
          ENVIRONMENT_NAME: props.environmentName,
        },
      });

      apiDeployOptions = {
        stageName: props.environmentName,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiAccessLogs),
        accessLogFormat: apigateway.AccessLogFormat.custom(JSON.stringify({
          requestId: apigateway.AccessLogField.contextRequestId(),
          apiId: apigateway.AccessLogField.contextApiId(),
          stage: apigateway.AccessLogField.contextStage(),
          httpMethod: apigateway.AccessLogField.contextHttpMethod(),
          resourcePath: apigateway.AccessLogField.contextResourcePath(),
          status: apigateway.AccessLogField.contextStatus(),
          responseLength: apigateway.AccessLogField.contextResponseLength(),
          responseLatency: apigateway.AccessLogField.contextResponseLatency(),
        })),
        dataTraceEnabled: false,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        metricsEnabled: true,
        tracingEnabled: false,
      };
    } else {
      apiDeployOptions = {
        stageName: props.environmentName,
        dataTraceEnabled: false,
        loggingLevel: apigateway.MethodLoggingLevel.OFF,
        metricsEnabled: true,
        tracingEnabled: false,
      };
    }

    const api = new apigateway.RestApi(this, 'PublicApi', {
      restApiName: `myeczema-${props.environmentName}-api`,
      description: `MyEczema ${props.environmentName} public API`,
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      cloudWatchRole: hasStandardIam,
      ...(hasStandardIam
        ? {
            cloudWatchRoleRemovalPolicy: props.environmentName === 'production'
              ? RemovalPolicy.RETAIN
              : RemovalPolicy.DESTROY,
          }
        : {}),
      deployOptions: apiDeployOptions,
    });

    const healthResource = api.root.addResource('health');
    if (healthFunction) {
      healthResource.addMethod(
        'GET',
        new apigateway.LambdaIntegration(healthFunction, {
          proxy: true,
          allowTestInvoke: false,
        }),
        {
          authorizationType: apigateway.AuthorizationType.NONE,
          operationName: 'GetHealth',
        },
      );
    } else {
      healthResource.addMethod('GET', new apigateway.MockIntegration({
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Cache-Control': "'no-store'",
              'method.response.header.Content-Type': "'application/json'",
            },
            responseTemplates: {
              'application/json': JSON.stringify({
                status: 'ok',
                service: 'myeczema-api',
                mode: 'power-user',
              }),
            },
          },
        ],
      }), {
        authorizationType: apigateway.AuthorizationType.NONE,
        operationName: 'GetHealth',
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Cache-Control': true,
              'method.response.header.Content-Type': true,
            },
          },
        ],
      });
    }

    const webAcl = new wafv2.CfnWebACL(this, 'PublicApiWebAcl', {
      name: `myeczema-${props.environmentName}-api`,
      description: `Managed protections and rate limit for the MyEczema ${props.environmentName} API`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `myeczema-${props.environmentName}-api-waf`,
        sampledRequestsEnabled: false,
      },
      rules: [
        {
          name: 'AWSManagedCommonRules',
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesCommonRuleSet',
              vendorName: 'AWS',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `myeczema-${props.environmentName}-waf-common`,
            sampledRequestsEnabled: false,
          },
        },
        {
          name: 'AWSManagedIpReputation',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesAmazonIpReputationList',
              vendorName: 'AWS',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `myeczema-${props.environmentName}-waf-ip-reputation`,
            sampledRequestsEnabled: false,
          },
        },
        {
          name: 'PerIpRateLimit',
          priority: 2,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: 'IP',
              limit: props.environmentName === 'production' ? 1_000 : 300,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `myeczema-${props.environmentName}-waf-rate-limit`,
            sampledRequestsEnabled: false,
          },
        },
      ],
    });

    const webAclAssociation = new wafv2.CfnWebACLAssociation(
      this,
      'PublicApiWebAclAssociation',
      {
        resourceArn: Fn.join('', [
          'arn:',
          Aws.PARTITION,
          ':apigateway:',
          Aws.REGION,
          '::/restapis/',
          api.restApiId,
          '/stages/',
          api.deploymentStage.stageName,
        ]),
        webAclArn: webAcl.attrArn,
      },
    );
    webAclAssociation.node.addDependency(api.deploymentStage);

    for (const domain of tableDomains) {
      new dynamodb.Table(this, `${domain}Table`, {
        tableName: `myeczema-${props.environmentName}-${domain}`,
        partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
        encryptionKey: dataKey,
        pointInTimeRecoverySpecification: {
          pointInTimeRecoveryEnabled: true,
        },
        removalPolicy: props.environmentName === 'production'
          ? RemovalPolicy.RETAIN
          : RemovalPolicy.DESTROY,
        deletionProtection: props.environmentName === 'production',
        ...(domain === 'chat' || domain === 'operations'
          ? { timeToLiveAttribute: 'expiresAtEpoch' }
          : {}),
      });
    }

    const deadLetterQueue = new sqs.Queue(this, 'WorkflowDeadLetterQueue', {
      queueName: `myeczema-${props.environmentName}-workflow-dlq`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dataKey,
      retentionPeriod: Duration.days(14),
    });

    new sqs.Queue(this, 'WorkflowQueue', {
      queueName: `myeczema-${props.environmentName}-workflow`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: dataKey,
      visibilityTimeout: Duration.seconds(90),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 5,
      },
    });

    const alertTopic = new sns.Topic(this, 'OperationalAlertsTopic', {
      topicName: `myeczema-${props.environmentName}-operational-alerts`,
      displayName: `MyEczema ${props.environmentName} operational alerts`,
      masterKey: dataKey,
    });

    const apiServerErrorAlarm = new cloudwatch.Alarm(this, 'ApiServerErrorAlarm', {
      alarmName: `myeczema-${props.environmentName}-api-5xx`,
      alarmDescription: 'Public API returned one or more 5xx responses in five minutes',
      metric: api.metricServerError({
        period: Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const operationalAlarms = [apiServerErrorAlarm];

    if (healthFunction) {
      operationalAlarms.push(new cloudwatch.Alarm(this, 'HealthFunctionErrorAlarm', {
        alarmName: `myeczema-${props.environmentName}-health-errors`,
        alarmDescription: 'Health Lambda returned one or more errors in five minutes',
        metric: healthFunction.metricErrors({
          period: Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }));
    }

    const workflowDeadLetterAlarm = new cloudwatch.Alarm(
      this,
      'WorkflowDeadLetterAlarm',
      {
        alarmName: `myeczema-${props.environmentName}-workflow-dlq-visible`,
        alarmDescription: 'A workflow message reached the dead-letter queue',
        metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible({
          period: Duration.minutes(5),
          statistic: 'Maximum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );

    operationalAlarms.push(workflowDeadLetterAlarm);

    for (const alarm of operationalAlarms) {
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
    }

    const dashboard = new cloudwatch.Dashboard(this, 'OperationsDashboard', {
      dashboardName: `myeczema-${props.environmentName}-operations`,
      defaultInterval: Duration.hours(3),
    });
    dashboard.addWidgets(...operationalAlarms.map(
      (alarm) => new cloudwatch.AlarmWidget({ alarm }),
    ));

    const integrationCredentials = new secretsmanager.Secret(
      this,
      'IntegrationCredentials',
      {
        secretName: `myeczema/${props.environmentName}/integration-credentials`,
        description: 'Placeholder for OAuth, push, and commerce provider credentials',
        encryptionKey: dataKey,
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            googleClientId: 'replace-after-provider-registration',
            appleServiceId: 'replace-after-provider-registration',
            stripeMode: 'test',
          }),
          generateStringKey: 'bootstrapNonce',
          excludePunctuation: true,
          passwordLength: 32,
        },
      },
    );
    integrationCredentials.applyRemovalPolicy(
      props.environmentName === 'production'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    );

    if (props.environmentName === 'demo') {
      const budgetAlertEmail = new CfnParameter(this, 'BudgetAlertEmail', {
        type: 'String',
        description: 'Email address for AWS demo spend alerts',
        allowedPattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        constraintDescription: 'must be a valid email address',
        noEcho: true,
      });

      new budgets.CfnBudget(this, 'MonthlyCostBudget', {
        budget: {
          budgetName: 'myeczema-demo-monthly-cost',
          budgetLimit: { amount: 250, unit: 'USD' },
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
        },
        notificationsWithSubscribers: budgetThresholdsUsd.map((threshold) => ({
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: 'ACTUAL',
            threshold,
            thresholdType: 'ABSOLUTE_VALUE',
          },
          subscribers: [
            {
              address: budgetAlertEmail.valueAsString,
              subscriptionType: 'EMAIL',
            },
          ],
        })),
        resourceTags: [
          { key: 'Application', value: 'MyEczema' },
          { key: 'Environment', value: props.environmentName },
        ],
      });
    }

    if (props.environmentName === 'demo' && hasStandardIam) {
      const githubProvider = new iam.OidcProviderNative(this, 'GitHubProvider', {
        oidcProviderName: 'GitHubActions',
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
      });

      const githubDeployRole = new iam.Role(this, 'GitHubDeployRole', {
        roleName: 'myeczema-demo-github-deploy',
        description: 'Allows approved nella GitHub workflows to assume CDK bootstrap roles',
        assumedBy: new iam.WebIdentityPrincipal(
          githubProvider.openIdConnectProviderArn,
          {
            StringEquals: {
              'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            },
            StringLike: {
              'token.actions.githubusercontent.com:sub': [
                'repo:cauBeEzic/nella:ref:refs/heads/main',
                'repo:cauBeEzic/nella:environment:demo',
              ],
            },
          },
        ),
        maxSessionDuration: Duration.hours(1),
      });

      githubDeployRole.addToPolicy(new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:role/cdk-hnb659fds-deploy-role-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
          `arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:role/cdk-hnb659fds-file-publishing-role-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
          `arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:role/cdk-hnb659fds-image-publishing-role-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
          `arn:${Aws.PARTITION}:iam::${Aws.ACCOUNT_ID}:role/cdk-hnb659fds-lookup-role-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
        ],
      }));

      new CfnOutput(this, 'GitHubDeployRoleArn', {
        value: githubDeployRole.roleArn,
        description: 'GitHub Actions OIDC role; no long-lived AWS access key required',
      });
    }

    new CfnOutput(this, 'PrivateMediaBucketName', {
      value: mediaBucket.bucketName,
      description: 'Private media bucket name; never expose directly to clients',
    });

    new CfnOutput(this, 'OperationalAlertsTopicArn', {
      value: alertTopic.topicArn,
      description: 'Subscribe an approved operational address before production use',
    });

    new CfnOutput(this, 'DeploymentMode', {
      value: props.deploymentMode,
      description: 'power-user omits IAM-created resources until administrator access exists',
    });

    new CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Amazon Cognito user pool for MyEczema accounts',
    });

    new CfnOutput(this, 'CognitoIosClientId', {
      value: iosClient.userPoolClientId,
      description: 'Public iOS app client; this identifier is safe to bundle in the app',
    });

    new CfnOutput(this, 'CognitoAndroidClientId', {
      value: androidClient.userPoolClientId,
      description: 'Public Android app client; this identifier is safe to bundle in the app',
    });
  }
}
