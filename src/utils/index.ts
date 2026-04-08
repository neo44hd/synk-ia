
export function createPageUrl(pageName: string) {
        if (!pageName) return '/ceodashboard';
    return '/' + pageName.toLowerCase().replace(/ /g, '-');
}
