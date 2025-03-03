export function isApiKey(text: string): boolean {
    const patterns = [
        /(sk_live_[0-9a-zA-Z]{24})/, // Stripe
        /(AKIA[0-9A-Z]{16})/, // AWS
    ];
    
    return patterns.some(pattern => pattern.test(text));
}

export function detectService(apiKey: string): string {
    if (apiKey.startsWith('sk_live_')) {
        return 'stripe';
    } else if (apiKey.startsWith('AKIA')) {
        return 'aws';
    } else {
        return 'unknown';
    }
}