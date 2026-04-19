import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 Bucket
    const invoiceBucket = new s3.Bucket(this, 'InvoiceLandingBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // 2. DynamoDB Tables
    const userTable = new dynamodb.Table(this, 'UserTable', {
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const invoiceTable = new dynamodb.Table(this, 'InvoiceTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. Processor Lambda
    const processorLambda = new NodejsFunction(this, 'ProcessorFunction', {
      entry: path.join(__dirname, '../lambda/processor.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: invoiceTable.tableName,
      },
    });

    invoiceBucket.grantRead(processorLambda);
    invoiceTable.grantWriteData(processorLambda);
    processorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['textract:AnalyzeExpense'],
      resources: ['*'],
    }));

    invoiceBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(processorLambda));

    // 4. API Lambda
    const apiLambda = new NodejsFunction(this, 'ApiFunction', {
      entry: path.join(__dirname, '../lambda/api-handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        INVOICE_TABLE: invoiceTable.tableName,
        USER_TABLE: userTable.tableName,
        BUCKET_NAME: invoiceBucket.bucketName,
      },
    });

    invoiceTable.grantReadWriteData(apiLambda);
    userTable.grantReadWriteData(apiLambda);
    invoiceBucket.grantPut(apiLambda);
    invoiceBucket.grantDelete(apiLambda);

    // 5. API Gateway
    const api = new apigateway.RestApi(this, 'InvoiceScannerApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE'],
      },
    });

    // /auth
    const auth = api.root.addResource('auth');
    auth.addResource('signup').addMethod('POST', new apigateway.LambdaIntegration(apiLambda));
    auth.addResource('login').addMethod('POST', new apigateway.LambdaIntegration(apiLambda));

    // /invoices
    const invoices = api.root.addResource('invoices');
    invoices.addMethod('GET', new apigateway.LambdaIntegration(apiLambda));
    invoices.addMethod('DELETE', new apigateway.LambdaIntegration(apiLambda));

    // /upload-url
    const uploadUrl = api.root.addResource('upload-url');
    uploadUrl.addMethod('GET', new apigateway.LambdaIntegration(apiLambda));

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}
