/**
 * Hermes Tool: OmniVoice Integration
 * 
 * Tool for Hermes agent to use OmniVoice for TTS, voice cloning,
 * and voice reporting.
 */

const OMNIVOICE_URL = 'http://localhost:8000';

export const omniVoiceTools = [
  {
    name: 'omnivoice_health',
    description: 'Check OmniVoice service health',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'omnivoice_speak',
    description: 'Generate speech from text using a voice profile',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to speak' },
        voiceId: { type: 'string', description: 'Voice profile ID (optional)' },
        speed: { type: 'number', description: 'Speech speed 0.5-2.0 (default 1.0)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'omnivoice_clone',
    description: 'Clone a voice from reference audio',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the cloned voice' },
        audioUrl: { type: 'string', description: 'URL to reference audio file' },
      },
      required: ['name', 'audioUrl'],
    },
  },
  {
    name: 'omnivoice_list_voices',
    description: 'List available voice profiles',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'omnivoice_dub',
    description: 'Dub audio into different languages',
    inputSchema: {
      type: 'object',
      properties: {
        audioUrl: { type: 'string', description: 'URL to source audio' },
        targetLang: { type: 'string', description: 'Target language code' },
        preserveTone: { type: 'boolean', description: 'Preserve original tone' },
      },
      required: ['audioUrl', 'targetLang'],
    },
  },
  {
    name: 'omnivoice_report',
    description: 'Generate a voice report (convenience function for betting reports)',
    inputSchema: {
      type: 'object',
      properties: {
        reportType: { type: 'string', enum: ['daily', 'alert', 'summary'], description: 'Type of report' },
        content: { type: 'string', description: 'Report content' },
        voiceId: { type: 'string', description: 'Voice to use' },
      },
      required: ['reportType', 'content'],
    },
  },
];

export async function callOmniVoice(toolName: string, args: Record<string, unknown>) {
  const endpoint = `${OMNIVOICE_URL}/api/v1/${toolName.replace('omnivoice_', '')}`;
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await res.json();
  } catch (err) {
    return { error: `OmniVoice unavailable: ${err.message}` };
  }
}