// Netlify Function to proxy Pipedrive API calls
// This solves CORS issues and keeps API key server-side

export const handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const apiKey = process.env.PIPEDRIVE_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Pipedrive API key not configured' })
      };
    }

    // Extract the API path and parameters from the request
    const { path } = event.queryStringParameters || {};
    
    if (!path) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'API path is required' })
      };
    }

    // Build the full Pipedrive API URL
    const baseUrl = path.includes('/api/v2/') 
      ? 'https://api.pipedrive.com/api/v2'
      : 'https://api.pipedrive.com/v1';
    
    const apiPath = path.replace('/api/v2/', '').replace('/v1/', '');
    const url = `${baseUrl}/${apiPath}`;

    // Get all query parameters except 'path'
    const queryParams = new URLSearchParams();
    queryParams.append('api_token', apiKey);
    
    // Add all other query parameters from the original request
    Object.entries(event.queryStringParameters || {}).forEach(([key, value]) => {
      if (key !== 'path' && value !== null) {
        queryParams.append(key, value);
      }
    });

    const fullUrl = `${url}?${queryParams.toString()}`;
    
    console.log('Proxying request to:', fullUrl.replace(apiKey, 'HIDDEN'));

    // Make the request to Pipedrive
    const response = await fetch(fullUrl, {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StaffLocationSort/1.0'
      },
      body: event.httpMethod === 'POST' ? event.body : undefined
    });

    const data = await response.text();
    
    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: data
    };

  } catch (error) {
    console.error('Pipedrive proxy error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};