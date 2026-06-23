import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.RATE_LIMIT_TABLE;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function checkRateLimit(userId, route, dailyCap) {
  if (!TABLE) return null;
  const day = new Date().toISOString().slice(0, 10);
  const pk = `${userId}#${route}#${day}`;

  try {
    const { Attributes } = await client.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk },
      UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :one, #ttl = :ttl',
      ExpressionAttributeNames: { '#c': 'count', '#ttl': 'expiresAt' },
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
        ':ttl': Math.floor(Date.now() / 1000) + 86400 * 2,
      },
      ReturnValues: 'ALL_NEW',
    }));

    if (Attributes.count > dailyCap) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Rate limit exceeded', limit: dailyCap }) };
    }
    return null;
  } catch (e) {
    console.error('Rate limit check failed:', e.message);
    return null;
  }
}
