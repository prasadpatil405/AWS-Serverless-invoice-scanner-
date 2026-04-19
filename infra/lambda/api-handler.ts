import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from 'crypto';

const rawDynamoClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(rawDynamoClient);
const s3Client = new S3Client({});

const INVOICE_TABLE = process.env.INVOICE_TABLE || '';
const USER_TABLE = process.env.USER_TABLE || '';
const BUCKET_NAME = process.env.BUCKET_NAME || '';

const hashPassword = (pass: string) => crypto.createHash('sha256').update(pass).digest('hex');

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { httpMethod, path, queryStringParameters } = event;
    const body = event.body ? JSON.parse(event.body) : {};
    const headers = { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE"
    };

    try {
        // --- AUTH ENDPOINTS ---
        if (httpMethod === 'POST' && path === '/auth/signup') {
            const { name, email, username, password } = body;
            if (!username || !password) return { statusCode: 400, headers, body: 'Missing fields' };
            
            await ddbDocClient.send(new PutCommand({
                TableName: USER_TABLE,
                Item: { 
                    username, 
                    name, 
                    email, 
                    password: hashPassword(password) 
                }
            }));
            return { statusCode: 200, headers, body: JSON.stringify({ message: 'User created' }) };
        }

        if (httpMethod === 'POST' && path === '/auth/login') {
            const { username, password } = body;
            const res = await ddbDocClient.send(new GetCommand({
                TableName: USER_TABLE,
                Key: { username }
            }));
            const user = res.Item;
            if (user && user.password === hashPassword(password)) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ userId: username, name: user.name }),
                };
            }
            return { statusCode: 401, headers, body: JSON.stringify({ message: 'Invalid credentials' }) };
        }

        // --- INVOICE ENDPOINTS ---
        if (httpMethod === 'GET' && path === '/invoices') {
            const userId = queryStringParameters?.userId;
            if (!userId) return { statusCode: 400, headers, body: 'userId required' };
            
            const response = await ddbDocClient.send(new QueryCommand({
                TableName: INVOICE_TABLE,
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId }
            }));
            return { statusCode: 200, headers, body: JSON.stringify(response.Items || []) };
        }

        if (httpMethod === 'DELETE' && path === '/invoices') {
            const { userId, id, s3Key } = queryStringParameters || {};
            if (!userId || !id) return { statusCode: 400, headers, body: 'keys required' };

            await ddbDocClient.send(new DeleteCommand({
                TableName: INVOICE_TABLE,
                Key: { userId, id }
            }));
            
            if (s3Key) {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key
                }));
            }

            return { statusCode: 200, headers, body: JSON.stringify({ message: 'Deleted' }) };
        }

        if (httpMethod === 'GET' && path === '/upload-url') {
            const { fileName, userId, contentType } = queryStringParameters || {};
            if (!fileName || !userId) return { statusCode: 400, headers, body: 'params required' };

            const id = `inv_${Date.now()}`;
            // Format: userId:::id:::filename
            const s3Key = `${userId}:::${id}:::${fileName}`;
            
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
                ContentType: contentType || 'application/pdf', 
            });

            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ uploadUrl, id, key: s3Key }),
            };
        }

        return { statusCode: 404, headers, body: 'Not Found' };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, headers, body: JSON.stringify({ message: (error as Error).message }) };
    }
};
