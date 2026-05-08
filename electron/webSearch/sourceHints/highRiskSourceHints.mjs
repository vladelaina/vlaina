const HIGH_RISK_SOURCE_HINTS = [
  {
    pattern: /\btrezor\b.*\b(suite|download|install|seed phrase|official)\b|trezor.*(\u4e0b\u8f7d|\u5b89\u88c5|\u52a9\u8bb0\u8bcd|\u5b98\u7f51|\u5b98\u65b9)/i,
    title: 'Trezor Suite',
    url: 'https://trezor.io/trezor-suite',
    snippet: 'Official Trezor Suite download page.',
  },
  {
    pattern: /\bcoinbase\b.*\b(login|signin|sign in|support phone|official)\b|coinbase.*(\u767b\u5f55|\u767b\u5165|\u5ba2\u670d|\u7535\u8bdd|\u5b98\u7f51|\u5b98\u65b9)/i,
    title: 'Coinbase Sign In',
    url: 'https://www.coinbase.com/signin',
    snippet: 'Official Coinbase sign-in page.',
  },
  {
    pattern: /\bbinance\b.*\b(app|download|install|official)\b|binance.*(\u4e0b\u8f7d|\u5b89\u88c5|app|\u5b98\u7f51|\u5b98\u65b9)/i,
    title: 'Download Binance App',
    url: 'https://www.binance.com/en/download',
    snippet: 'Official Binance app download page.',
  },
  {
    pattern: /\baws\b.*\b(cli|command line)\b.*\b(install|download|docs?|documentation|official)\b|aws.*cli.*(\u5b89\u88c5|\u4e0b\u8f7d|\u6587\u6863|\u5b98\u65b9)/i,
    title: 'Install or update to the latest version of the AWS CLI',
    url: 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html',
    snippet: 'Official AWS CLI installation documentation.',
  },
  {
    pattern: /\bstripe\b.*\bcli\b.*\b(docs?|documentation|official)\b/i,
    title: 'Stripe CLI',
    url: 'https://docs.stripe.com/stripe-cli',
    snippet: 'Official Stripe CLI documentation.',
  },
  {
    pattern: /\bstripe\b.*\b(api|docs?|documentation|secret key|exposed|official)\b|stripe.*(api|\u6587\u6863|\u5bc6\u94a5|\u6cc4\u9732|\u5b98\u65b9)/i,
    title: 'Stripe API Reference',
    url: 'https://docs.stripe.com/api',
    snippet: 'Official Stripe API reference.',
  },
  {
    pattern: /\bpaypal\b.*\b(developer|api|sandbox|docs?|documentation|official)\b|paypal.*(\u5f00\u53d1|api|\u6c99\u76d2|\u6587\u6863|\u5b98\u65b9)/i,
    title: 'PayPal Developer Documentation',
    url: 'https://developer.paypal.com/docs/',
    snippet: 'Official PayPal developer documentation.',
  },
  {
    pattern: /\breact router\b.*\b(docs?|documentation|official)\b|react router.*(\u6587\u6863|\u5b98\u7f51|\u5b98\u65b9)/i,
    title: 'React Router Docs',
    url: 'https://reactrouter.com/home',
    snippet: 'Official React Router documentation.',
  },
  {
    pattern: /\bprisma\b.*\b(docs?|documentation|official|get started)\b|prisma.*(\u6587\u6863|\u5b98\u7f51|\u5b98\u65b9)/i,
    title: 'Prisma Documentation',
    url: 'https://www.prisma.io/docs',
    snippet: 'Official Prisma documentation.',
  },
];

export function buildHighRiskSourceHints(query) {
  return HIGH_RISK_SOURCE_HINTS.filter((hint) => hint.pattern.test(query)).map((hint) => ({
    title: hint.title,
    url: hint.url,
    snippet: hint.snippet,
    publishedAt: null,
    source: 'local-web-search',
    thumbnail: null,
  }));
}
