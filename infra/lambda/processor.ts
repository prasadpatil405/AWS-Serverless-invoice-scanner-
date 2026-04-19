import { S3Event } from 'aws-lambda';
import { TextractClient, AnalyzeExpenseCommand } from "@aws-sdk/client-textract";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const textractClient = new TextractClient({});
const rawDynamoClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(rawDynamoClient);

const TABLE_NAME = process.env.TABLE_NAME || '';

export const handler = async (event: S3Event) => {
    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        console.log(`Processing file: s3://${bucket}/${key}`);
        
        // Key format: userId:::id:::filename
        const parts = key.split(':::');
        if (parts.length < 3) {
            console.error("Invalid key format. Expected userId:::id:::filename", key);
            continue;
        }

        const userId = parts[0];
        const originalId = parts[1];
        const fileName = parts.slice(2).join(':::');

        try {
            const analyzeExpenseCommand = new AnalyzeExpenseCommand({
                Document: {
                    S3Object: { Bucket: bucket, Name: key },
                },
            });

            const textractResponse = await textractClient.send(analyzeExpenseCommand);
            const expenseDoc = textractResponse.ExpenseDocuments?.[0];
            
            const summaryFields = expenseDoc?.SummaryFields || [];
            const extractedData: any = {
                userId: userId,
                id: originalId, // Use the generated ID as sort key
                fileName: fileName,
                s3Key: key,
                status: 'COMPLETED',
                processedAt: new Date().toISOString(),
                items: []
            };

            summaryFields.forEach(field => {
                const type = field.Type?.Text;
                const value = field.ValueDetection?.Text;
                if (type === 'VENDOR_NAME') extractedData.vendor = value;
                if (type === 'TOTAL') extractedData.total = value;
                if (type === 'INVOICE_RECEIPT_DATE' || type === 'DATE') extractedData.date = value;
            });

            const lineItemGroups = expenseDoc?.LineItemGroups || [];
            lineItemGroups.forEach(group => {
                group.LineItems?.forEach(item => {
                    const itemData: any = {};
                    item.LineItemExpenseFields?.forEach(field => {
                        const type = field.Type?.Text;
                        const value = field.ValueDetection?.Text;
                        if (type === 'ITEM' || type === 'EXPENSE_ROW') itemData.description = value;
                        if (type === 'QUANTITY') itemData.quantity = value;
                        if (type === 'PRICE' || type === 'UNIT_PRICE') itemData.price = value;
                    });
                    if (Object.keys(itemData).length > 0) extractedData.items.push(itemData);
                });
            });

            await ddbDocClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: extractedData,
            }));

        } catch (error) {
            console.error(`Error processing ${key}:`, error);
            await ddbDocClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    userId: userId,
                    id: originalId,
                    fileName: fileName,
                    s3Key: key,
                    status: 'FAILED',
                    error: (error as Error).message,
                    processedAt: new Date().toISOString(),
                }
            }));
        }
    }
};
