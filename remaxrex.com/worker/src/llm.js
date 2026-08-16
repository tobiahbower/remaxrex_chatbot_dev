const SYSTEM_PROMPT = `You are a helpful assistant for RE/MAX Rex real estate website.

Rules:
- Answer ONLY using the provided context about RE/MAX Rex.
- If the answer is not in the context, say you don't have that information and suggest contacting their office.
- Be concise, professional, and friendly.
- Do not invent services, agents, locations, or contact information.
- For property search questions, direct users to contact an agent (specifically Ana and Gus Perona) or use the rex-fl.remax.com map search for self-directed searching.
- Prefer recent and accurate information from the provided context.`;

/**
 * @param {string} context
 * @param {string} question
 * @returns {{ role: string, content: string }[]}
 */
export function buildMessages(context, question) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Context:\n${context}\n\nQuestion: ${question}`, // Template Literal (multiline string)
    },
  ];
}

/**
 * @param {object} env
 * @param {{ role: string, content: string }[]} messages
 */
export async function generateAnswer(env, messages) {
  const model = env.LLM_MODEL || '@cf/meta/llama-3.2-3b-instruct';

  const response = await env.AI.run(model, {
    messages,
    max_tokens: Number(env.LLM_MAX_TOKENS || 512),
    temperature: Number(env.LLM_TEMPERATURE || 0.2),
  });

  const answer =
    response?.response ??
    response?.result?.response ??
    response?.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error('LLM returned an empty response');
  }

  return String(answer).trim();
}

/**
 * Optional guardrails — extend with topic filters, regex blocks, etc.
 * @param {string} message
 * @param {object} env
 */
export function validateUserMessage(message, env) {
  const maxLength = Number(env.MAX_MESSAGE_LENGTH || 500);
  const trimmed = message.trim();

  if (!trimmed) {
    return { ok: false, error: 'Message cannot be empty.' };
  }

  if (trimmed.length > maxLength) {
    return { ok: false, error: `Message must be ${maxLength} characters or fewer.` };
  }

  return { ok: true, message: trimmed };
}
