
export function createPageUrl(pageName: string) {
    if (!pageName) return '/dashboard';
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}
