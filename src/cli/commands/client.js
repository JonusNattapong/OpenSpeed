OpenSpeed\src\cli\commands\client.js
import { writeFile } from 'fs/promises';
import { join } from 'path';

function clientCommand() {
  return {
    command: 'client [output]',
    describe: 'Generate TypeScript client with end-to-end type safety from OpenAPI spec',
    builder: (yargs) => {
      return yargs
        .positional('output', {
          describe: 'Output file path for the client',
          type: 'string',
          default: 'client.ts'
        })
        .option('url', {
          describe: 'Base URL of the running OpenSpeed server',
          type: 'string',
          default: 'http://localhost:3000'
        });
    },
    handler: async (argv) => {
      const { output, url } = argv;

      try {
        console.log('🔄 Fetching client from server...');

        const response = await fetch(`${url}/client.ts`);
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }

        const clientCode = await response.text();

        await writeFile(output, clientCode);

        console.log(`✅ Client generated successfully at ${output}`);
        console.log('💡 Import and use OpenSpeedClient in your frontend for full type safety!');
        console.log('   Example: const client = new OpenSpeedClient("http://localhost:3000");');

      } catch (error) {
        console.error('❌ Failed to generate client:', error.message);
        console.log('💡 Make sure your OpenSpeed server is running and has the openapi plugin enabled.');
        process.exit(1);
      }
    }
  };
}

export default clientCommand;
