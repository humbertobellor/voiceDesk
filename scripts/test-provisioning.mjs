  import { createClient } from '@supabase/supabase-js'                                                                                                              
  import { readFileSync } from 'fs'                                                                            
                                                                                                                                                                    
  // Load .env.local
  const env = Object.fromEntries(                                                                                                                                   
    readFileSync('.env.local', 'utf8')                                                                         
      .split('\n')                       
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(line => {                                                                                                                                                
        const idx = line.indexOf('=')
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]                                                                                              
      })                                                                                                       
  )                                      

  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL                                                                                                                 
  const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                                                                                                                                                                    
  const [,, email, password, areaCode = '305'] = process.argv                                                                                                       
  if (!email || !password) {             
    console.error('Usage: node scripts/test-provisioning.mjs <email> <password> [area_code]')                                                                       
    process.exit(1)                                                                                            
  }                                      

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)                                                                                                    
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) { console.error('Auth failed:', error.message); process.exit(1) }                                                                                      
                                                                                                                                                                    
  // Build cookie matching @supabase/ssr's storage key format
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]                                                                                                   
  const cookieName = `sb-${projectRef}-auth-token`                                                             
  const { session } = data                                                                                                                                          
  const cookiePayload = JSON.stringify({
    access_token: session.access_token,                                                                                                                             
    token_type:   session.token_type,                                                                          
    expires_in:   session.expires_in,                                                                                                                               
    expires_at:   session.expires_at,
    refresh_token: session.refresh_token,                                                                                                                           
    user:          session.user,                                                                               
  })                                     

  console.log('Signed in as:', data.user.email)
  console.log('Calling POST /api/provisioning/create with area_code:', areaCode, '...\n')                                                                           
   
  const response = await fetch('http://localhost:3000/api/provisioning/create', {                                                                                   
    method: 'POST',                                                                                                                                                 
    headers: {                           
      'Content-Type': 'application/json',                                                                                                                           
      'Cookie': `${cookieName}=${encodeURIComponent(cookiePayload)}`,                                          
    },                                                                                                                                                              
    body: JSON.stringify({ area_code: areaCode }),
  })                                                                                                                                                                
                                                                                                               
  const result = await response.json()   
  console.log('HTTP Status:', response.status)
  console.log('Response:', JSON.stringify(result, null, 2))
                                                                                                                                                                    
  if (response.ok) {
    console.log('\n✓ Provisioned successfully!')                                                                                                                    
    console.log('  Phone number:', result.twilio_number)                                                       
    console.log('  Retell agent ID:', result.retell_agent_id)
    console.log('\nCall', result.twilio_number, 'from your mobile to run Test 2.')                                                                                  
  }                                                                                                                                                    
