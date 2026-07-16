import axios from 'axios';

const DEFAULT_TIMEOUT_MS = 45000;

const getAiServiceConfig = () => {
  const baseUrl = String(process.env.AI_SERVICE_BASE_URL || 'http://127.0.0.1:8011').trim().replace(/\/$/, '');
  const sharedSecret = String(process.env.AI_SERVICE_SHARED_SECRET || '').trim();
  const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  return {
    baseUrl,
    sharedSecret,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
};

const buildHeaders = (sharedSecret) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (sharedSecret) {
    headers['X-AI-Service-Secret'] = sharedSecret;
  }

  return headers;
};

export const sendChatMessageToAIService = async (payload) => {
  const { baseUrl, sharedSecret, timeoutMs } = getAiServiceConfig();

  try {
    const response = await axios.post(`${baseUrl}/chat`, payload, {
      timeout: timeoutMs,
      headers: buildHeaders(sharedSecret),
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail || error.response.data?.message || 'AI service request failed.';

      const serviceError = new Error(detail);
      serviceError.status = status === 401 ? 502 : 500;
      serviceError.details = error.response.data;
      throw serviceError;
    }

    if (error.code === 'ECONNABORTED') {
      const timeoutError = new Error('AI service request timed out.');
      timeoutError.status = 504;
      throw timeoutError;
    }

    const networkError = new Error('Could not reach the AI service.');
    networkError.status = 502;
    throw networkError;
  }
};

export const streamChatFromAIService = async (payload) => {
  const { baseUrl, sharedSecret, timeoutMs } = getAiServiceConfig();

  try {
    const response = await axios.post(`${baseUrl}/chat/stream`, payload, {
      timeout: timeoutMs,
      headers: buildHeaders(sharedSecret),
      responseType: 'stream',
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const serviceError = new Error('AI service stream request failed.');
      serviceError.status = status === 401 ? 502 : 500;
      throw serviceError;
    }

    if (error.code === 'ECONNABORTED') {
      const timeoutError = new Error('AI service stream request timed out.');
      timeoutError.status = 504;
      throw timeoutError;
    }

    const networkError = new Error('Could not reach the AI service for streaming.');
    networkError.status = 502;
    throw networkError;
  }
};

export const generateRecommendationExplanation = async (payload) => {
  const { baseUrl, sharedSecret, timeoutMs } = getAiServiceConfig();

  try {
    const response = await axios.post(`${baseUrl}/recommendations/explain`, payload, {
      timeout: timeoutMs,
      headers: buildHeaders(sharedSecret),
    });

    return response.data;
  } catch (error) {
    console.error('generateRecommendationExplanation error:', error.message);
    throw error;
  }
};
