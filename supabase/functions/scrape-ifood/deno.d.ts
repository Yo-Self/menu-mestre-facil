// Declarações de tipos para Deno em Supabase Edge Functions
declare global {
  namespace Deno {
    interface Env {
      get(key: string): string | undefined;
    }
    
    class Command {
      constructor(command: string, options: {
        args?: string[];
        cwd?: string;
        stdout?: 'piped' | 'inherit' | 'null';
        stderr?: 'piped' | 'inherit' | 'null';
      });
      
      output(): Promise<{
        stdout: Uint8Array;
        stderr: Uint8Array;
        success: boolean;
      }>;
    }
    
    function cwd(): string;
    
    const env: Env;
  }
}

export {};
