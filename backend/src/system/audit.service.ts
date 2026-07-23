import { AuditRepository } from './audit.repository';

export class AuditService {
  private repository = new AuditRepository();

  async getLogs(filters: any, page: number, limit: number) {
     const result = await this.repository.getPaginated(filters, page, limit);

     // Strip sensitive payloads globally mapping everything to *****
     result.data = result.data.map((log) => {
        let cleanPrev = log.previousValues;
        let cleanNew = log.newValues;

        const scrubString = (jsonStr: string | null) => {
           if (!jsonStr) return jsonStr;
           try {
              const obj = JSON.parse(jsonStr);
              const secrets = ['password', 'token', 'accessToken', 'refreshToken', 'webhookSecret', 'publicKey', 'secret', 'cookie', 'creditCard', 'cvvu'];
              const redact = (o: any) => {
                 for (let key in o) {
                    if (o.hasOwnProperty(key)) {
                       if (secrets.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
                          o[key] = '*********';
                       } else if (typeof o[key] === 'object' && o[key] !== null) {
                          redact(o[key]);
                       }
                    }
                 }
              };
              redact(obj);
              return JSON.stringify(obj);
           } catch {
              return jsonStr; // Not json
           }
        }

        return {
           ...log,
           previousValues: scrubString(cleanPrev),
           newValues: scrubString(cleanNew)
        }
     });

     return result;
  }

  async getStats() {
     return this.repository.getStats();
  }
}
