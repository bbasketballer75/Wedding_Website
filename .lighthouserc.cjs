// .lighthouserc.cjs
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/gallery',
        'http://localhost:4173/film',
        'http://localhost:4173/guest-photos',
      ],
      startServerCommand: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      startServerReadyPattern: 'Local',
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.6 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
