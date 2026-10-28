import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';

import { MyEczemaFoundationStack } from '../lib/foundation-stack.js';

describe('MyEczemaFoundationStack', () => {
  const createTemplate = () => {
    const app = new App();
    const stack = new MyEczemaFoundationStack(app, 'TestStack', {
      deploymentMode: 'standard',
      environmentName: 'demo',
      env: { account: '111111111111', region: 'ca-central-1' },
    });

    return Template.fromStack(stack);
  };

  const createProductionTemplate = () => {
    const app = new App();
    const stack = new MyEczemaFoundationStack(app, 'ProductionTestStack', {
      deploymentMode: 'standard',
      environmentName: 'production',
      env: { account: '111111111111', region: 'ca-central-1' },
    });

    return Template.fromStack(stack);
  };

  const createPowerUserTemplate = () => {
    const app = new App();
    const stack = new MyEczemaFoundationStack(app, 'PowerUserTestStack', {
      deploymentMode: 'power-user',
      environmentName: 'demo',
      env: { account: '111111111111', region: 'ca-central-1' },
    });

    return Template.fromStack(stack);
  };

  let demoTemplate: Template;
  let productionTemplate: Template;
  let powerUserTemplate: Template;
  beforeAll(() => {
    demoTemplate = createTemplate();
    productionTemplate = createProductionTemplate();
    powerUserTemplate = createPowerUserTemplate();
  });

  it('creates encrypted private storage and the bounded-context tables', () => {
    const template = demoTemplate;

    template.resourceCountIs('AWS::DynamoDB::Table', 6);
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: Match.anyValue(),
    });
    template.resourceCountIs('AWS::SQS::Queue', 2);
  });

  it('creates a payload-safe health API protected by WAF', () => {
    const template = demoTemplate;

    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'myeczema-demo-health',
      Handler: 'index.handler',
      Runtime: 'nodejs22.x',
      ReservedConcurrentExecutions: 5,
    });
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'demo',
      MethodSettings: Match.arrayWith([
        Match.objectLike({
          DataTraceEnabled: false,
          LoggingLevel: 'ERROR',
          MetricsEnabled: true,
        }),
      ]),
    });
    template.resourceCountIs('AWS::WAFv2::WebACL', 1);
    template.resourceCountIs('AWS::WAFv2::WebACLAssociation', 1);

    const renderedTemplate = JSON.stringify(template.toJSON());
    expect(renderedTemplate).not.toContain('$context.requestBody');
    expect(renderedTemplate).not.toContain('$context.identity.userAgent');
  });

  it('creates alarms, an operations dashboard, and encrypted secret placeholders', () => {
    const template = demoTemplate;

    template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'myeczema/demo/integration-credentials',
      KmsKeyId: Match.anyValue(),
    });
  });

  it('configures USD spend alerts without committing the subscriber email', () => {
    const template = demoTemplate;

    template.hasParameter('BudgetAlertEmail', {
      Type: 'String',
      NoEcho: true,
    });
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: {
        BudgetLimit: { Amount: 250, Unit: 'USD' },
        BudgetName: 'myeczema-demo-monthly-cost',
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
      },
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: {
            ComparisonOperator: 'GREATER_THAN',
            NotificationType: 'ACTUAL',
            Threshold: 50,
            ThresholdType: 'ABSOLUTE_VALUE',
          },
        }),
        Match.objectLike({
          Notification: {
            ComparisonOperator: 'GREATER_THAN',
            NotificationType: 'ACTUAL',
            Threshold: 100,
            ThresholdType: 'ABSOLUTE_VALUE',
          },
        }),
        Match.objectLike({
          Notification: {
            ComparisonOperator: 'GREATER_THAN',
            NotificationType: 'ACTUAL',
            Threshold: 250,
            ThresholdType: 'ABSOLUTE_VALUE',
          },
        }),
      ]),
    });

    expect(JSON.stringify(template.toJSON())).not.toContain('vueric2005@gmail.com');
  });

  it('allows only the approved repository to assume the demo deployment role', () => {
    const template = demoTemplate;

    template.resourceCountIs('AWS::IAM::OIDCProvider', 1);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'myeczema-demo-github-deploy',
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
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
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  it('does not reuse demo budget or GitHub deployment access in production', () => {
    const template = productionTemplate;

    template.resourceCountIs('AWS::Budgets::Budget', 0);
    template.resourceCountIs('AWS::IAM::OIDCProvider', 0);
    expect(template.toJSON().Parameters?.BudgetAlertEmail).toBeUndefined();
  });

  it('supports a bootstrap-free demo without creating IAM or Lambda resources', () => {
    const template = powerUserTemplate;

    template.resourceCountIs('AWS::IAM::Role', 0);
    template.resourceCountIs('AWS::IAM::Policy', 0);
    template.resourceCountIs('AWS::IAM::OIDCProvider', 0);
    template.resourceCountIs('AWS::Lambda::Function', 0);
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      AuthorizationType: 'NONE',
      HttpMethod: 'GET',
      Integration: Match.objectLike({ Type: 'MOCK' }),
      OperationName: 'GetHealth',
    });
  });

  it('creates an email user pool with separate secretless mobile clients', () => {
    const template = powerUserTemplate;

    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AutoVerifiedAttributes: ['email'],
      UsernameAttributes: ['email'],
      UserPoolName: 'myeczema-demo',
    });
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 2);
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'myeczema-demo-ios',
      EnableTokenRevocation: true,
      GenerateSecret: false,
      PreventUserExistenceErrors: 'ENABLED',
      AllowedOAuthFlows: ['code'],
      CallbackURLs: ['myeczema://auth/callback'],
    });
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'myeczema-demo-android',
      EnableTokenRevocation: true,
      GenerateSecret: false,
      PreventUserExistenceErrors: 'ENABLED',
      AllowedOAuthFlows: ['code'],
      CallbackURLs: ['myeczema://auth/callback'],
    });
  });
});
