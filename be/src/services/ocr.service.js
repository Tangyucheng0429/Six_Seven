import { openai } from '../config/openai.js';

/**
 * Parses a receipt image using OpenAI's gpt-4o.
 * Tailored for Malaysian receipts, extracting subtotal, tax (SST 6%), service charge (10%), total, and items.
 * @param {string} imageUrl - The public URL of the uploaded receipt.
 * @returns {Promise<Object>} Structured JSON parsed from receipt.
 */
export async function parseReceiptImage(imageUrl) {
  try {
    const systemPrompt = `You are an expert AI OCR Scanner specializing in Malaysian receipts.
Analyze the provided receipt image and extract structured data in JSON format.

Specifically, identify and extract:
1. "subtotal": The sum of all item prices before service charge, tax, or rounding.
2. "tax_amount": SST / Service Tax / Government Tax (typically 6% in Malaysia).
3. "service_charge": Service Charge (typically 10% in Malaysia).
4. "total_amount": The absolute final amount paid on the receipt, after tax, service charge, and any rounding.
5. "items": An array of items purchased, where each item has:
   - "item_name": String, standardized readable name of the item.
   - "price": Unit price of one item (e.g. total item row price divided by quantity, represented as a decimal).
   - "quantity": Integer, count of items (default 1).

Malaysian Specific Guidelines:
- Pay close attention to "SST 6%", "Service Tax 6%", "Gov Tax 6%", "Service Charge 10%".
- Be mindful of "Rounding Adjustment" or "Rounding" (which adjusts the final price by 1-4 sen to round to the nearest 5 sen). Make sure total_amount is strictly the final paid total.
- Ensure all numeric values are numbers, not strings.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "subtotal": 100.00,
  "tax_amount": 6.00,
  "service_charge": 10.00,
  "total_amount": 116.00,
  "items": [
    {
      "item_name": "Chicken Rice",
      "price": 12.50,
      "quantity": 2
    }
  ]
}
Do not include any explanations, markdown code blocks, or additional text. Just output the raw JSON object.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please scan and parse this Malaysian receipt.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'malaysian_receipt_scan',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              subtotal: {
                type: 'number',
                description: 'The sum of all item prices before service charge, tax, or rounding.'
              },
              tax_amount: {
                type: 'number',
                description: 'SST / Service Tax / Government Tax (typically 6% in Malaysia).'
              },
              service_charge: {
                type: 'number',
                description: 'Service Charge (typically 10% in Malaysia).'
              },
              total_amount: {
                type: 'number',
                description: 'The absolute final amount paid on the receipt, after tax, service charge, and any rounding.'
              },
              items: {
                type: 'array',
                description: 'List of food/drink items purchased.',
                items: {
                  type: 'object',
                  properties: {
                    item_name: {
                      type: 'string',
                      description: 'Standardized readable name of the item.'
                    },
                    price: {
                      type: 'number',
                      description: 'Unit price of one item.'
                    },
                    quantity: {
                      type: 'integer',
                      description: 'Count of items.'
                    }
                  },
                  required: ['item_name', 'price', 'quantity'],
                  additionalProperties: false
                }
              }
            },
            required: ['subtotal', 'tax_amount', 'service_charge', 'total_amount', 'items'],
            additionalProperties: false
          }
        }
      }
    });

    const parsedData = JSON.parse(response.choices[0].message.content);
    console.log('[OCR Service] Parsed data successfully:', parsedData);

    // Normalize output and apply defaults
    const result = {
      subtotal: parseFloat(parsedData.subtotal || 0),
      tax_amount: parseFloat(parsedData.tax_amount || 0),
      service_charge: parseFloat(parsedData.service_charge || 0),
      total_amount: parseFloat(parsedData.total_amount || 0),
      items: Array.isArray(parsedData.items) ? parsedData.items : []
    };

    result.items = result.items.map(item => ({
      item_name: item.item_name || 'Unknown Item',
      price: parseFloat(item.price || 0),
      quantity: parseInt(item.quantity || 1, 10)
    }));

    return result;
  } catch (error) {
    console.error('[OCR Service] Error parsing receipt image:', error);
    throw new Error(`AI OCR scanning failed: ${error.message}`);
  }
}
