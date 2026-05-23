import OpenAI from 'openai';
import dotenv from 'dotenv';
import { mockOpenai } from './openai.mock.js';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (process.env.NODE_ENV !== 'test') {
  if (!apiKey) {
    throw new Error('CRITICAL CONFIG ERROR: OPENAI_API_KEY is missing in your .env file.');
  }
}

export const openai = process.env.NODE_ENV === 'test'
  ? mockOpenai
  : new OpenAI({
      apiKey: apiKey || 'placeholder'
    });

