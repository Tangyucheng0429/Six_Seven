/**
 * Mock OpenAI client for testing.
 * Path: src/config/openai.mock.js
 */
export const mockOpenai = {
  chat: {
    completions: {
      create: async () => {
        // Return a mock parsed receipt that matches our exact test expectations
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  subtotal: 100.00,
                  tax_amount: 6.00,
                  service_charge: 10.00,
                  total_amount: 116.00,
                  items: [
                    { item_name: 'Chicken Rice', price: 20.00, quantity: 2 },
                    { item_name: 'Deep Fried Fish', price: 50.00, quantity: 1 },
                    { item_name: 'Teh Tarik', price: 5.00, quantity: 2 }
                  ]
                })
              }
            }
          ]
        };
      }
    }
  }
};
