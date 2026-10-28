#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { MyEczemaFoundationStack } from '../lib/foundation-stack.js';

const app = new cdk.App();
const environmentNameValue: unknown = app.node.tryGetContext('environment') ?? 'demo';
const deploymentRegion = String(app.node.tryGetContext('region') ?? 'ca-central-1');
const deploymentModeValue: unknown = app.node.tryGetContext('deploymentMode')
  ?? (environmentNameValue === 'demo' ? 'power-user' : 'standard');

if (environmentNameValue !== 'demo' && environmentNameValue !== 'production') {
  throw new Error(`Unsupported environment: ${String(environmentNameValue)}`);
}

if (deploymentModeValue !== 'power-user' && deploymentModeValue !== 'standard') {
  throw new Error(`Unsupported deployment mode: ${String(deploymentModeValue)}`);
}

const environmentName: 'demo' | 'production' = environmentNameValue;
const deploymentMode: 'power-user' | 'standard' = deploymentModeValue;

new MyEczemaFoundationStack(app, `MyEczema-${environmentName}-Foundation`, {
  deploymentMode,
  environmentName,
  env: {
    ...(process.env.CDK_DEFAULT_ACCOUNT
      ? { account: process.env.CDK_DEFAULT_ACCOUNT }
      : {}),
    region: deploymentRegion,
  },
  description: `MyEczema ${environmentName} regional API, data, security, and operations foundation`,
  ...(deploymentMode === 'power-user'
    ? {
        synthesizer: new cdk.CliCredentialsStackSynthesizer() as unknown as cdk.IStackSynthesizer,
      }
    : {}),
});
