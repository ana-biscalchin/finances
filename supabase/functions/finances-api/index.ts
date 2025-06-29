// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    // Ajuste: responde para qualquer rota que termine com /finances-api ou /finances-api/
    if (path.endsWith('/finances-api') || path.endsWith('/finances-api/')) {
      return new Response(
        JSON.stringify({ 
          message: 'Bem-vindo à API de Finanças no Supabase!',
          timestamp: new Date().toISOString(),
          status: 'online'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else if (path.endsWith('/finances-api/health')) {
      return new Response(
        JSON.stringify({ 
          status: 'OK',
          timestamp: new Date().toISOString(),
          environment: 'supabase-edge-function'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          path,
          available_routes: [
            '/functions/v1/finances-api/',
            '/functions/v1/finances-api/health'
          ]
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 