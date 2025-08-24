// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { db, importLogs } from './db.ts'
import { eq, and, desc } from 'drizzle-orm'

// Initialize Supabase client for JWT verification
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type for context variables
type Variables = {
  userId: string
}

// change this to your function name
const functionName = 'scrape-menudino'
const app = new Hono<{ Variables: Variables }>().basePath(`/${functionName}`)

// Helper function to extract user ID from JWT
async function getUserIdFromToken(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.split(' ')[1]
  
  // TODO: Remove this test code when implementing real authentication
  // For testing: allow service role token
  if (token === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU') {
    return '550e8400-e29b-41d4-a716-446655440000' // Valid test UUID
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    return null
  }

  return user.id
}

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: "ok", 
    message: "MenuDino Scraper Edge Function",
    timestamp: new Date().toISOString()
  });
});

// Helper function to check for existing import logs
async function findExistingImportLog(userId: string, url: string) {
  try {
    const existingLogs = await db
      .select()
      .from(importLogs)
      .where(and(
        eq(importLogs.userId, userId),
        eq(importLogs.url, url)
      ))
      .orderBy(desc(importLogs.createdAt))
      .limit(1)

    if (existingLogs.length === 0) {
      return null
    }

    const log = existingLogs[0]
    const now = new Date()
    const logCreatedAt = new Date(log.createdAt)
    const timeDiffMinutes = (now.getTime() - logCreatedAt.getTime()) / (1000 * 60)

    // Return existing log if it's in preview_ready state
    if (log.status === 'preview_ready') {
      return log
    }

    // Return existing log if it's import_success and less than 2 minutes old
    if (log.status === 'import_success' && timeDiffMinutes < 2) {
      return log
    }

    return null
  } catch (error) {
    console.error('Error checking existing import logs:', error)
    return null
  }
}

// Background scraping task
async function startBackgroundScraping(importLogId: string, _url: string, _userId: string) {
  try {
    console.log(`Starting background scraping for import log ${importLogId}`)
    
    // Update status to processing
    await db
      .update(importLogs)
      .set({ 
        status: 'processing',
        startedAt: new Date()
      })
      .where(eq(importLogs.id, importLogId))

    // Simulate scraping process (this will be implemented in HU 1.3)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock scraped data for now
    const mockScrapedData = {
      restaurant: {
        name: "Restaurante Teste",
        cuisine_type: "Brasileira",
        address: "Rua Teste, 123",
        phone: "(11) 99999-9999"
      },
      categories: ["Pratos Principais", "Bebidas", "Sobremesas"],
      menu_items: [
        {
          name: "Prato Teste 1",
          category: "Pratos Principais",
          price: 25.90,
          description: "Descrição do prato teste"
        },
        {
          name: "Bebida Teste",
          category: "Bebidas", 
          price: 8.50
        }
      ],
      extraction_metadata: {
        html_length: 12345,
        extracted_at: new Date().toISOString(),
        processing_time_ms: 2000,
        extraction_quality_score: 0.95
      }
    }

    // Update status to preview_ready with scraped data
    await db
      .update(importLogs)
      .set({
        status: 'preview_ready',
        scrapedData: mockScrapedData,
        categoriesCount: mockScrapedData.categories.length,
        dishesCount: mockScrapedData.menu_items.length,
        itemsProcessed: mockScrapedData.menu_items.length,
        itemsTotal: mockScrapedData.menu_items.length,
        durationMs: 2000
      })
      .where(eq(importLogs.id, importLogId))

    console.log(`Background scraping completed for import log ${importLogId}`)

  } catch (error) {
    console.error(`Background scraping failed for import log ${importLogId}:`, error)
    
    // Update status to scraping_failed
    await db
      .update(importLogs)
      .set({
        status: 'scraping_failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error during scraping',
        completedAt: new Date()
      })
      .where(eq(importLogs.id, importLogId))
  }
}

// Scrape endpoint - HU 1.2
app.post('/scrape', async (c) => {
  const startTime = Date.now()
  
  try {
    // Authenticate user
    const userId = await getUserIdFromToken(c.req.header('Authorization'))
    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const body = await c.req.json()
    const { url } = body

    // Validate input
    if (!url || typeof url !== 'string') {
      return c.json({ 
        error: "URL is required and must be a string" 
      }, 400)
    }

    // Basic URL validation
    try {
      new URL(url)
    } catch {
      return c.json({
        error: "Invalid URL format"
      }, 400)
    }

    // Check for existing import logs (FR12)
    const existingLog = await findExistingImportLog(userId, url)
    if (existingLog) {
      console.log(`Returning existing import log ${existingLog.id} for URL ${url}`)
      return c.json({
        success: true,
        importLogId: existingLog.id,
        message: "Using existing import log",
        fromCache: true
      })
    }

    // Create new import log (FR2)
    const newLog = await db
      .insert(importLogs)
      .values({
        userId,
        url,
        status: 'scraping',
        source: 'menudino',
        startedAt: new Date(),
        retryCount: 0
      })
      .returning({ id: importLogs.id })

    const importLogId = newLog[0].id

    // Start background scraping task (FR4)
    EdgeRuntime.waitUntil(
      startBackgroundScraping(importLogId, url, userId)
    )

    const responseTime = Date.now() - startTime
    console.log(`Created import log ${importLogId} in ${responseTime}ms`)

    // Respond immediately with import log ID (FR3)
    return c.json({
      success: true,
      importLogId,
      message: "Scraping initiated",
      responseTime
    })

  } catch (error) {
    console.error("Error in /scrape endpoint:", error)
    
    // Return HTTP 500 if database creation fails (AC 6)
    return c.json({ 
      error: "Failed to create import log",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500)
  }
})

// Import endpoint placeholder
app.post('/import', async (c) => {
  try {
    // Authenticate user
    const userId = await getUserIdFromToken(c.req.header('Authorization'))
    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const body = await c.req.json()
    const { importLogId } = body

    if (!importLogId) {
      return c.json({ 
        error: "importLogId is required" 
      }, 400)
    }

    // Verify the import log exists and belongs to the user
    const logs = await db
      .select()
      .from(importLogs)
      .where(and(
        eq(importLogs.id, importLogId),
        eq(importLogs.userId, userId)
      ))
      .limit(1)

    if (logs.length === 0) {
      return c.json({
        error: "Import log not found"
      }, 404)
    }

    const log = logs[0]
    
    if (log.status !== 'preview_ready') {
      return c.json({
        error: `Import log is not ready for import. Current status: ${log.status}`
      }, 400)
    }

    // TODO: Implement actual import logic in HU 1.5
    return c.json({
      success: true,
      message: "Import initiated (will be implemented in HU 1.5)",
      importLogId
    })

  } catch (error) {
    console.error("Error in /import endpoint:", error)
    return c.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500)
  }
})

Deno.serve(app.fetch)
