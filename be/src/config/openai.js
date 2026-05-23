import OpenAI from 'openai';
import dotenv from 'dotenv';
import { mockOpenai } from './openai.mock.js';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey && process.env.NODE_ENV !== 'test') {
  console.warn('Warning: OpenAI API Key is not configured in your .env file.');
}

export const openai = process.env.NODE_ENV === 'test'
  ? mockOpenai
  : new OpenAI({
      apiKey: apiKey || 'placeholder'
    });

