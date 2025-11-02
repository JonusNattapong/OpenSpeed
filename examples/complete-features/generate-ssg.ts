/**
 * Static Site Generation Script for Complete Features Example
 * Run this to generate static HTML files from the OpenSpeed app
 */

import { app } from './index.js';
import { generateStatic, defineRoutes } from '../../src/openspeed/plugins/ssg.js';
import * as fs from 'fs';
import * as path from 'path';

async function generate() {
  console.log('🔨 Starting Static Site Generation...\n');

  // Define routes to pre-render
  const routes = defineRoutes([
    '/',
    '/about',
    '/docs',
    '/jsx-demo',
    '/api/products',
    '/api/status',
    '/health',
  ]);

  try {
    // Start the server temporarily for SSG
    const PORT = 3001;
    const server = app.listen(PORT, () => {
      console.log(`📡 Temporary server started on port ${PORT} for SSG\n`);
    });

    // Wait a bit for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate static site
    const stats = await generateStatic(
      app,
      routes,
      {
        outputDir: './examples/complete-features/dist',
        baseUrl: `http://localhost:${PORT}`,
        cleanOutputDir: true,
        pretty: true,
        onGenerate: (route, html) => {
          console.log(`✓ Generated: ${route.path}`);
        },
        onComplete: (stats) => {
          console.log('\n📊 SSG Statistics:');
          console.log(`   Total Routes: ${stats.totalRoutes}`);
          console.log(`   Generated Files: ${stats.generatedFiles}`);
          console.log(`   Failed Routes: ${stats.failedRoutes.length}`);
          console.log(`   Output Directory: ${stats.outputDir}`);
          console.log(`   Duration: ${stats.duration}ms\n`);

          if (stats.failedRoutes.length > 0) {
            console.log('❌ Failed routes:');
            stats.failedRoutes.forEach((route) => {
              console.log(`   - ${route}`);
            });
          }
        },
      }
    );

    // Generate sitemap.xml
    const sitemap = generateSitemap(routes, 'https://openspeed.dev');
    fs.writeFileSync(
      path.join('./examples/complete-features/dist', 'sitemap.xml'),
      sitemap,
      'utf-8'
    );
    console.log('✓ Generated sitemap.xml');

    // Generate robots.txt
    const robots = generateRobots('https://openspeed.dev/sitemap.xml');
    fs.writeFileSync(
      path.join('./examples/complete-features/dist', 'robots.txt'),
      robots,
      'utf-8'
    );
    console.log('✓ Generated robots.txt');

    // Stop the temporary server
    if (server && typeof server.close === 'function') {
      server.close();
      console.log('\n🛑 Temporary server stopped');
    }

    console.log('\n✅ Static Site Generation Complete!');
    console.log(`📁 Files available in: ./examples/complete-features/dist\n`);

    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error('\n❌ SSG Generation failed:', error);
    process.exit(1);
  }
}

/**
 * Generate sitemap.xml
 */
function generateSitemap(
  routes: Array<{ path: string }>,
  baseUrl: string
): string {
  const urls = routes
    .map((route) => {
      const url = `${baseUrl}${route.path}`;
      const lastmod = new Date().toISOString().split('T')[0];

      return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * Generate robots.txt
 */
function generateRobots(sitemapUrl: string): string {
  return `# Robots.txt for OpenSpeed Complete Features Demo
User-agent: *
Allow: /

# Disallow API endpoints from crawling
Disallow: /api/
Disallow: /__rpc/

# Sitemap
Sitemap: ${sitemapUrl}
`;
}

// Run generation
generate();
