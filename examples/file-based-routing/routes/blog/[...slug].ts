import type { Context } from '../../../src/openspeed/context.js';

// Mock blog posts data
const blogPosts = [
  {
    slug: 'getting-started-with-openspeed',
    title: 'Getting Started with OpenSpeed',
    content: 'OpenSpeed is a high-performance web framework inspired by Hono and Elysia...',
    author: 'Alice Johnson',
    publishedAt: '2024-01-15T10:00:00Z',
    tags: ['openspeed', 'tutorial', 'getting-started'],
  },
  {
    slug: 'file-based-routing-guide',
    title: 'File-Based Routing Guide',
    content: 'Learn how to use file-based routing in OpenSpeed with dynamic routes and catch-alls...',
    author: 'Bob Smith',
    publishedAt: '2024-01-20T14:30:00Z',
    tags: ['routing', 'file-based', 'guide'],
  },
  {
    slug: 'performance-optimization',
    title: 'Performance Optimization Techniques',
    content: 'Discover advanced performance optimization techniques for OpenSpeed applications...',
    author: 'Charlie Brown',
    publishedAt: '2024-01-25T11:20:00Z',
    tags: ['performance', 'optimization', 'advanced'],
  },
];

export async function GET(ctx: Context) {
  const { slug } = ctx.params;

  if (!slug) {
    // If no slug provided, return all blog posts
    return ctx.json({
      posts: blogPosts.map(post => ({
        slug: post.slug,
        title: post.title,
        author: post.author,
        publishedAt: post.publishedAt,
        tags: post.tags,
      })),
      total: blogPosts.length,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle different slug patterns
  const slugParts = Array.isArray(slug) ? slug : [slug];

  if (slugParts.length === 1) {
    // Single slug: /blog/getting-started-with-openspeed
    const post = blogPosts.find(p => p.slug === slugParts[0]);

    if (!post) {
      return ctx.json({ error: 'Blog post not found' }, { status: 404 });
    }

    return ctx.json({
      post,
      timestamp: new Date().toISOString(),
    });
  }

  if (slugParts.length === 2) {
    // Two parts: could be /blog/year/month or /blog/category/tag
    const [part1, part2] = slugParts;

    // Try to parse as year/month
    const year = parseInt(part1);
    const month = parseInt(part2);

    if (!isNaN(year) && !isNaN(month) && year >= 2020 && year <= 2030 && month >= 1 && month <= 12) {
      // Filter posts by year and month
      const filteredPosts = blogPosts.filter(post => {
        const postDate = new Date(post.publishedAt);
        return postDate.getFullYear() === year && postDate.getMonth() + 1 === month;
      });

      return ctx.json({
        posts: filteredPosts,
        filter: { year, month },
        total: filteredPosts.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Try as category/tag
    const filteredPosts = blogPosts.filter(post =>
      post.tags.includes(part1) || post.tags.includes(part2)
    );

    return ctx.json({
      posts: filteredPosts,
      filter: { category: part1, tag: part2 },
      total: filteredPosts.length,
      timestamp: new Date().toISOString(),
    });
  }

  if (slugParts.length >= 3) {
    // Three or more parts: complex filtering
    // For example: /blog/2024/01/tech
    const [year, month, ...filters] = slugParts;

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (!isNaN(yearNum) && !isNaN(monthNum)) {
      let filteredPosts = blogPosts.filter(post => {
        const postDate = new Date(post.publishedAt);
        return postDate.getFullYear() === yearNum && postDate.getMonth() + 1 === monthNum;
      });

      // Apply additional filters
      if (filters.length > 0) {
        filteredPosts = filteredPosts.filter(post =>
          filters.some(filter => post.tags.includes(filter))
        );
      }

      return ctx.json({
        posts: filteredPosts,
        filter: { year: yearNum, month: monthNum, tags: filters },
        total: filteredPosts.length,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Fallback: return all posts with slug info
  return ctx.json({
    message: 'Catch-all route matched',
    slug: slugParts,
    availablePosts: blogPosts.map(p => p.slug),
    timestamp: new Date().toISOString(),
  });
}
