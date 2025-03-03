export function isApiKey(text: string): boolean {
    const patterns = [
        /(sk_live_[0-9a-zA-Z]{24})/, // Stripe
        /(AKIA[0-9A-Z]{16})/, // AWS
    ];
    
    return patterns.some(pattern => pattern.test(text));
}
