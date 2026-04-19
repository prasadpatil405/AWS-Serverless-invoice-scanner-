# AWS Serverless Invoice Scanner 🚀

A powerful, full-stack serverless application that utilizes AWS Textract to automatically scan, analyze, and extract data from invoices.

## 🔗 Live Demo
**Frontend**: [https://aws-serverless-invoice-scanner.vercel.app/](https://aws-serverless-invoice-scanner.vercel.app/)

## ✨ Features
- **Modern UI**: Sleek, glassmorphism design built with Next.js 15.
- **Serverless Backend**: Powered by AWS Lambda, DynamoDB, and S3.
- **AI-Powered Extraction**: Uses AWS Textract for precise expense analysis.
- **Secure Auth**: Private user dashboards and secure login/signup.
- **Data Isolation**: Multi-tenant architecture ensuring users only see their own data.

## 🛠️ Technology Stack
- **Frontend**: Next.js (React), Tailwind CSS-inspired Vanilla CSS.
- **Infrastructure**: AWS Cloud Development Kit (CDK), AWS Lambda (Node.js 20).
- **Storage**: AWS S3 (Documents), AWS DynamoDB (Metadata).
- **AI**: AWS Textract (Analyze Expense).

## 🚀 Getting Started

### Local Frontend
1. Navigate to `frontend/`.
2. Run `npm install`.
3. Run `npm run dev`.

### Infrastructure Deployment
1. Navigate to `infra/`.
2. Run `npm install`.
3. Configure your AWS credentials.
4. Run `npx cdk deploy`.

## 📄 License
Copyright (c) 2024 Prasad Patil. All rights reserved.
