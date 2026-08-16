import { createRetriever } from './retriever.js';
import { buildMessages, generateAnswer, validateUserMessage } from './llm.js';

// cache refresh rate
const KNOWLEDGE_CACHE_TTL_MS = 5 * 60 * 1000;
let knowledgeCache = {
  fetchedAt: 0,
  text: '',
  json: null,
};

// Embedded knowledge for demo purposes (temporary solution)
const EMBEDDED_KNOWLEDGE = `# RE/MAX Rex — Real Estate Services

## About RE/MAX Rex

RE/MAX Rex is here to assist you with a dedicated team of full-time Realtors. Our experienced broker team provides invaluable support, backed by a deep knowledge of the real estate industry. We believe there's a perfect property for everyone, and we're committed to making a difference in your buying, renting, or selling experience.

Our proven marketing, management, and sales techniques ensure optimal service and reduced market time. At RE/MAX Rex, we pride ourselves on our team of well-qualified and experienced agents who work seriously, hard, and honestly to achieve the best results for our clients.

## Contact Information

**Main Office:**
- Address: 2240 Woolbright Road, Suite 343, Boynton Beach, FL 33426
- Phone: 1-561 220 1520
- Email: info@remaxrex.com

**Additional Location:**
- Address: 8300 NW 53rd Street, Doral, FL 33166

**Website:** https://remaxrex.com

## Services

### Residential Real Estate
Buying a home is one of the most important personal decisions of your life. It might also be one of the most complex transactions you ever make. Our residential team helps you navigate the home buying process with expertise and care.

### Commercial Real Estate
To invest in a commercial property you need a complete financial analysis and market analysis in your real estate property with the only reason, to get the correct decision and overcome your expectations.

### Rental Properties
We assist with both finding rental properties and managing rental investments.

## Property Search

For customers who want to search for properties themselves, we offer multiple search options:

1. **Quick Search** - Use the search bar on our website to search by city, area, zip code, MLS number, or address
2. **Map Search** - Use our interactive map search with polygon/bounding box functionality at https://rex-fl.remax.com/index.php?showagency=1&rtype=map
3. **Address Search** - Search for specific properties by address

**For personalized assistance**, we recommend contacting our experienced agents directly.

## Key Agents

**Ana Armua** - Available for residential and commercial real estate assistance
**Gus Perona** - Available for residential and commercial real estate assistance

**Office Phone:** 1-561 220 1520

## Our Values

- **Christian Values:** Upholding principles of faith, compassion, and integrity in all our interactions
- **Commitment to Clients:** Prioritizing the needs and satisfaction of our clients in every transaction
- **Honesty:** Ensuring transparency and truthfulness in all our dealings
- **Respect:** Valuing and respecting each client, agent, and partner we work with

## How to Start Your Home Search

The best way to start your home search is to:

1. **Contact an agent directly** - Our experienced agents, including Ana Armua and Gus Perona, can provide personalized guidance based on your specific needs, budget, and preferences
2. **Use our map search** - For self-directed searching, visit https://rex-fl.remax.com and use the interactive map search with polygon/bounding box functionality to explore properties in your desired areas
3. **Quick search** - Use the search bar on our website to search by city, area, zip code, MLS number, or address

Our agents can help you understand the market, find properties that match your criteria, negotiate offers, and guide you through the closing process.

## Office Hours and Availability

Our team is available to assist you during regular business hours. For urgent inquiries or to schedule a consultation, please call our main office at 1-561 220 1520 or email info@remaxrex.com.`;

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://remaxrex.com,http://localhost:8000,http://127.0.0.1:8000')
    .split(',') // comma delimiter
    .map((value) => value.trim()) // remove whitespace and linebreaks
    .filter(Boolean); // remove empty strings

  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // HTTP methods allowed
    'Access-Control-Allow-Headers': 'Content-Type', // HTTP headers allowed
    'Access-Control-Max-Age': '86400', // cache preflight for 24 hours
  };

  if (origin && allowed.includes(origin)) { // switching origin to * would allow any website
    headers['Access-Control-Allow-Origin'] = origin; 
  }

  return headers;
}

function jsonResponse(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, env),
    },
  });
}

async function fetchKnowledge(env) {
  const now = Date.now();
  if (knowledgeCache.text && now - knowledgeCache.fetchedAt < KNOWLEDGE_CACHE_TTL_MS) {
    return knowledgeCache;
  }

  const knowledgeUrl = env.KNOWLEDGE_URL || 'https://remaxrex.com/data/knowledge.md';
  const knowledgeJsonUrl = env.KNOWLEDGE_JSON_URL || 'https://remaxrex.com/data/knowledge.json';

  const [mdResponse, jsonResponse_] = await Promise.all([
    fetch(knowledgeUrl),
    fetch(knowledgeJsonUrl),
  ]);

  let text = EMBEDDED_KNOWLEDGE; // Use embedded knowledge as fallback
  let json = { retrieval_mode: 'full', version: '1.0.0', last_updated: '2024-08-08' };

  if (mdResponse.ok) {
    text = await mdResponse.text();
  }

  if (jsonResponse_.ok) {
    json = await jsonResponse_.json();
  }

  knowledgeCache = {
    fetchedAt: now,
    text,
    json,
  };

  return knowledgeCache;
}

async function handleChat(request, env, origin) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400, origin, env);
  }
  // check if message is not empty and < max characters limit
  const validation = validateUserMessage(payload.message || '', env);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400, origin, env);
  }

  // this returns 'full' meaning full context, not vector search
  const knowledge = await fetchKnowledge(env);
  const mode = env.RETRIEVAL_MODE || knowledge.json?.retrieval_mode || 'full';
  const retriever = createRetriever(mode);

  const retrieval =
    mode === 'vector'
      ? await retriever.retrieve(validation.message, knowledge.text, env, knowledge.json)
      : await retriever.retrieve(validation.message, knowledge.text);

  const messages = buildMessages(retrieval.context, validation.message);
  const answer = await generateAnswer(env, messages);

  return jsonResponse(
    {
      answer,
      mode,
      sources: retrieval.sources,
    },
    200,
    origin,
    env
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204, // no content
        headers: corsHeaders(origin, env),
      });
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true }, 200, origin, env);
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      try {
        return await handleChat(request, env, origin);
      } catch (error) {
        console.error(error);
        return jsonResponse(
          { error: 'Chat request failed.', details: error.message },
          500, // internal server error
          origin,
          env
        );
      }
    }

    return jsonResponse({ error: 'Not found' }, 404, origin, env);
  },
};
