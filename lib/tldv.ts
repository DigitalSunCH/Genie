// =============================================================================
// Types
// =============================================================================

export interface TldvInvitee {
  name: string;
  email: string;
}

export interface TldvOrganizer {
  name: string;
  email: string;
}

export interface TldvMeetingMetadata {
  id: string;
  happenedAt: string;
  invitees: TldvInvitee[];
  name: string;
  duration: number; // seconds
  organizer: TldvOrganizer;
  url: string;
  template?: {
    id: string;
    label: string;
  };
  extraProperties?: {
    conferenceId?: string;
  };
}

export interface TldvDialogEntry {
  startTime: number; // seconds from start
  endTime: number; // seconds from start
  speaker: string;
  text: string;
}

export interface TldvTranscript {
  id: string;
  meetingId: string;
  data: TldvDialogEntry[];
}

export interface ChunkedDialog {
  text: string;
  speaker: string;
  startTime: number;
  endTime: number;
  chunkIndex: number;
}

// =============================================================================
// API Client
// =============================================================================

const TLDV_API_BASE = "https://pasta.tldv.io/v1alpha1";

function getApiKey(): string {
  const apiKey = process.env.TLDV_API_KEY;
  if (!apiKey) {
    throw new Error("TLDV_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Extract meeting ID from a tldv URL
 * Supports formats:
 * - https://tldv.io/app/meetings/6964bbb53251f90013b21596
 * - 6964bbb53251f90013b21596 (raw ID)
 */
export function extractMeetingId(urlOrId: string): string {
  // If it's already just an ID (24 hex chars)
  if (/^[a-f0-9]{24}$/i.test(urlOrId.trim())) {
    return urlOrId.trim();
  }

  // Try to extract from URL
  const match = urlOrId.match(/meetings\/([a-f0-9]{24})/i);
  if (match) {
    return match[1];
  }

  throw new Error("Invalid tldv URL or meeting ID format");
}

/**
 * Fetch meeting metadata from tldv API
 */
export async function fetchMeetingMetadata(meetingId: string): Promise<TldvMeetingMetadata> {
  const response = await fetch(`${TLDV_API_BASE}/meetings/${meetingId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch meeting metadata: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch meeting transcript from tldv API
 */
export async function fetchTranscript(meetingId: string): Promise<TldvTranscript> {
  const response = await fetch(`${TLDV_API_BASE}/meetings/${meetingId}/transcript`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch transcript: ${response.status} ${errorText}`);
  }

  return response.json();
}

// =============================================================================
// Meeting List API
// =============================================================================

export interface TldvMeetingsListResponse {
  page: number;
  pageSize: number;
  pages: number;
  total: number;
  results: TldvMeetingMetadata[];
}

/**
 * Fetch a single page of meetings from the tldv API
 */
export async function fetchMeetingsPage(page: number = 1): Promise<TldvMeetingsListResponse> {
  const response = await fetch(`${TLDV_API_BASE}/meetings?page=${page}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch meetings: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch all meetings from the tldv API (with pagination)
 * @param maxPages - Maximum number of pages to fetch (optional, for limiting large fetches)
 */
export async function fetchAllMeetings(maxPages?: number): Promise<TldvMeetingMetadata[]> {
  const allMeetings: TldvMeetingMetadata[] = [];
  
  // Fetch first page to get total pages
  const firstPage = await fetchMeetingsPage(1);
  allMeetings.push(...firstPage.results);
  
  const totalPages = maxPages ? Math.min(firstPage.pages, maxPages) : firstPage.pages;
  
  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    const pageData = await fetchMeetingsPage(page);
    allMeetings.push(...pageData.results);
    
    // Small delay to avoid rate limiting
    if (page < totalPages) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  
  return allMeetings;
}

/**
 * Check if an email matches the organizer or any invitee of a meeting
 */
export function meetingHasAttendee(meeting: TldvMeetingMetadata, email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check organizer
  if (meeting.organizer?.email?.toLowerCase() === normalizedEmail) {
    return true;
  }
  
  // Check invitees
  if (meeting.invitees?.some((inv) => inv.email?.toLowerCase() === normalizedEmail)) {
    return true;
  }
  
  return false;
}

/**
 * Filter meetings by attendee email (checks both organizer and invitees)
 */
export function filterMeetingsByEmail(
  meetings: TldvMeetingMetadata[],
  email: string
): TldvMeetingMetadata[] {
  if (!email.trim()) {
    return meetings;
  }
  
  return meetings.filter((meeting) => meetingHasAttendee(meeting, email));
}

/**
 * Fetch meetings from tldv API filtered by attendee email
 * This fetches all meetings and filters client-side since the API doesn't support email filtering
 */
export async function fetchMeetingsByAttendeeEmail(
  email: string,
  maxPages?: number
): Promise<TldvMeetingMetadata[]> {
  const allMeetings = await fetchAllMeetings(maxPages);
  return filterMeetingsByEmail(allMeetings, email);
}

// =============================================================================
// Token Estimation
// =============================================================================

// Rough estimate: ~4 characters per token for English text
const CHARS_PER_TOKEN = 4;
const MAX_TOKENS_PER_CHUNK = 500;
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN; // ~2000 chars

/**
 * Estimate token count from text length
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// =============================================================================
// Chunking
// =============================================================================

/**
 * Format time in seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Split text at sentence boundaries
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or end of string
  // Keep the punctuation with the sentence
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [];
  
  // If no sentence boundaries found, return the whole text
  if (sentences.length === 0 && text.trim()) {
    return [text.trim()];
  }
  
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Chunk a dialog entry, splitting at sentence boundaries if it exceeds max chars
 */
export function chunkDialog(
  dialog: TldvDialogEntry,
  maxChars: number = MAX_CHARS_PER_CHUNK
): ChunkedDialog[] {
  const chunks: ChunkedDialog[] = [];
  const timeRange = `${formatTime(dialog.startTime)}-${formatTime(dialog.endTime)}`;
  const prefix = `${dialog.speaker} (${timeRange}): `;
  
  const prefixLength = prefix.length;
  const availableChars = maxChars - prefixLength;
  
  // Check if the whole dialog fits
  const fullText = prefix + dialog.text;
  
  if (fullText.length <= maxChars) {
    chunks.push({
      text: fullText,
      speaker: dialog.speaker,
      startTime: dialog.startTime,
      endTime: dialog.endTime,
      chunkIndex: 0,
    });
    return chunks;
  }
  
  // Need to split - use sentence boundaries
  const sentences = splitIntoSentences(dialog.text);
  let currentChunk = "";
  let chunkIndex = 0;
  
  for (const sentence of sentences) {
    // If a single sentence exceeds available chars, split by words
    if (sentence.length > availableChars) {
      // First, flush current chunk if any
      if (currentChunk) {
        chunks.push({
          text: prefix + currentChunk.trim(),
          speaker: dialog.speaker,
          startTime: dialog.startTime,
          endTime: dialog.endTime,
          chunkIndex: chunkIndex++,
        });
        currentChunk = "";
      }
      
      // Split the long sentence by words
      const words = sentence.split(/\s+/);
      let wordChunk = "";
      
      for (const word of words) {
        if (wordChunk.length + word.length + 1 > availableChars && wordChunk) {
          chunks.push({
            text: prefix + wordChunk.trim(),
            speaker: dialog.speaker,
            startTime: dialog.startTime,
            endTime: dialog.endTime,
            chunkIndex: chunkIndex++,
          });
          wordChunk = word + " ";
        } else {
          wordChunk += word + " ";
        }
      }
      
      // Add remaining words to current chunk for next iteration
      if (wordChunk) {
        currentChunk = wordChunk;
      }
    } else if (currentChunk.length + sentence.length > availableChars) {
      // Adding this sentence would exceed limit - flush current chunk
      if (currentChunk) {
        chunks.push({
          text: prefix + currentChunk.trim(),
          speaker: dialog.speaker,
          startTime: dialog.startTime,
          endTime: dialog.endTime,
          chunkIndex: chunkIndex++,
        });
      }
      currentChunk = sentence + " ";
    } else {
      // Add sentence to current chunk
      currentChunk += sentence + " ";
    }
  }
  
  // Flush remaining chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: prefix + currentChunk.trim(),
      speaker: dialog.speaker,
      startTime: dialog.startTime,
      endTime: dialog.endTime,
      chunkIndex: chunkIndex,
    });
  }
  
  return chunks;
}

/**
 * Chunk all dialogs in a transcript
 */
export function chunkTranscript(
  dialogs: TldvDialogEntry[],
  maxChars: number = MAX_CHARS_PER_CHUNK
): ChunkedDialog[] {
  const allChunks: ChunkedDialog[] = [];
  
  for (const dialog of dialogs) {
    const chunks = chunkDialog(dialog, maxChars);
    allChunks.push(...chunks);
  }
  
  return allChunks;
}

// =============================================================================
// Metadata Formatting
// =============================================================================

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minute${mins !== 1 ? "s" : ""}`;
  }
  return `${mins} minute${mins !== 1 ? "s" : ""}`;
}

/**
 * Format meeting date to human-readable string
 */
export function formatMeetingDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format meeting metadata as searchable text for Pinecone
 */
export function formatMeetingMetadataText(metadata: TldvMeetingMetadata): string {
  const parts: string[] = [];
  
  parts.push(`Meeting: ${metadata.name}`);
  parts.push(`Date: ${formatMeetingDate(metadata.happenedAt)}`);
  parts.push(`Duration: ${formatDuration(metadata.duration)}`);
  
  if (metadata.organizer) {
    const org = metadata.organizer;
    parts.push(`Organizer: ${org.name || org.email}${org.name ? ` (${org.email})` : ""}`);
  }
  
  if (metadata.invitees && metadata.invitees.length > 0) {
    const participants = metadata.invitees
      .map((inv) => inv.name ? `${inv.name} (${inv.email})` : inv.email)
      .join(", ");
    parts.push(`Participants: ${participants}`);
  }
  
  return parts.join("\n");
}

/**
 * Construct the tldv meeting URL from meeting ID
 */
export function constructTldvUrl(meetingId: string): string {
  return `https://tldv.io/app/meetings/${meetingId}`;
}
