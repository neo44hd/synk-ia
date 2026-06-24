import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MDRepository {
    constructor() {
        this.baseDir = path.join(__dirname, '../../../data/markdown');
        fs.ensureDirSync(this.baseDir);
    }

    async saveDocument(id, metadata, content) {
        const filePath = path.join(this.baseDir, `${id}.md`);
        const fileContent = matter.stringify(content, metadata);
        await fs.writeFile(filePath, fileContent);
        return filePath;
    }

    async getDocument(id) {
        const filePath = path.join(this.baseDir, `${id}.md`);
        const content = await fs.readFile(filePath, 'utf8');
        return matter(content);
    }

    async deleteDocument(id) {
        const filePath = path.join(this.baseDir, `${id}.md`);
        await fs.remove(filePath);
    }

    async listDocuments() {
        const files = await fs.readdir(this.baseDir);
        return files.filter(f => f.endsWith('.md'));
    }
}

export default MDRepository;
