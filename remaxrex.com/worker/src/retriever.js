/**
 * Retriever interface — swap implementations without changing the chat handler.
 *
 * v1: FullContextRetriever (entire knowledge doc in prompt)
 * v2: VectorRetriever (Vectorize / embeddings — stub included)
 */

export class FullContextRetriever {
  /**
   * @param {string} knowledgeText
   * @returns {Promise<{ context: string, sources: string[] }>}
   */
  async retrieve(_query, knowledgeText) {
    return {
      context: knowledgeText,
      sources: ['knowledge.md', 'site.md'],
    };
  }
}

export class VectorRetriever {
  /**
   * Future: query Vectorize index, return top-k chunks.
   * @param {string} query
   * @param {object} env
   * @param {object} knowledgeJson
   */

  // this will return undefined, vector index is not configured in Cloudflare
  // it costs money i think
  async retrieve(query, _knowledgeText, env, knowledgeJson) {
    if (!env.VECTORIZE_INDEX) {
      throw new Error('VECTORIZE_INDEX binding is not configured');
    }

    if (!env.AI) {
      throw new Error('Workers AI binding is required for vector retrieval');
    }

    // send to Cloudflare AI to embed query (turn text into numbers)
    // the ? is a optional chaining operator, basically an isempty() try catch check
    const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: query });
    const vector = embedding?.data?.[0] ?? embedding?.data;
    if (!vector) {
      throw new Error('Failed to generate query embedding');
    }

    /*
    To check if there is a vectorize index on my Cloudflare account:
    `npx wrangler vectorize list` in the project directory
    */
    const matches = await env.VECTORIZE_INDEX.query(vector, {
      topK: Number(env.VECTOR_TOP_K || 5),
      returnMetadata: true,
    });

    const chunks = matches.matches?.map((match) => match.metadata?.text).filter(Boolean) ?? [];
    if (chunks.length === 0) {
      return {
        context: knowledgeJson.full_context,
        sources: ['fallback-full-context'],
      };
    }

    return {
      context: chunks.join('\n\n'),
      sources: matches.matches?.map((match) => match.id).filter(Boolean) ?? [],
    };
  }
}

/**
 * @param {'full' | 'vector'} mode
 * @returns {FullContextRetriever | VectorRetriever}
 */
export function createRetriever(mode) {
  return mode === 'vector' ? new VectorRetriever() : new FullContextRetriever();
}
