import { NextRequest, NextResponse } from "next/server";
import dns from 'dns';
import { promisify } from 'util';
import validator from "validator"

const resolveMx = promisify(dns.resolveMx);

export interface ValidationResult {
    email: string;
    valid?: boolean;
    reason?: string | null;
}

export interface ValidationSummary {
    total: number;
    invalid: number;
    valid: number;
    validEmails: ValidationResult[],
    invalidEmails: ValidationResult[],
    validEmailsList: ValidationResult[],
    results: ValidationResult[];
}

export interface ValidationError {
    error: string;
}

export type ValidationResponse = ValidationSummary | ValidationError;

interface MxRecord {
    exchange: string;
    priority: number;
}

interface CacheEntry {
    records: MxRecord[] | null;
    timestamp: number;
}

class EmailValidator {
    private dnsCache: Map<string, CacheEntry>;
    private readonly cacheDuration: number;
    private readonly disposableDomains: Set<string>;

    constructor() {
        this.dnsCache = new Map();
        this.cacheDuration = 3600000; // 1 hour
        this.disposableDomains = new Set([
            'tempmail.com',
            'throwawaymail.com',
            'temporarymail.com',
            'temp-mail.org',
            'fakeinbox.com',
            'guerrillamail.com',
            'yopmail.com',
            'mailinator.com',
            // Add more as needed
        ]);
    }

    private validateFormat(email: string): boolean {
        return validator.isEmail(email);
    }

    private validateLength(localPart: string, domain: string): boolean {
        if (localPart.length > 64) return false;
        if (domain.length > 255) return false;
        const domainParts = domain.split('.');
        return !domainParts.some(part => part.length > 63);
    }

    private async getCachedMxRecords(domain: string): Promise<MxRecord[] | null> {
        const now = Date.now();
        const cached = this.dnsCache.get(domain);

        if (cached && cached.timestamp + this.cacheDuration > now) {
            return cached.records;
        }

        try {
            const records = await resolveMx(domain);
            this.dnsCache.set(domain, { records, timestamp: now });
            return records;
        } catch (error) {
            this.dnsCache.set(domain, { records: null, timestamp: now });
            console.log(error)
            return null;
        }
    }

    private isDisposableEmail(email: string): boolean {
        const domain = email.split('@')[1].toLowerCase();
        return this.disposableDomains.has(domain);
    }

    public async verify(email: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            email,
            valid: false,
            reason: null
        };

        try {
            // Basic format validation
            if (!this.validateFormat(email)) {
                result.reason = 'Invalid email format';
                return result;
            }

            const [localPart, domain] = email.split('@');

            // Length validation
            if (!this.validateLength(localPart, domain)) {
                result.reason = 'Email length validation failed';
                return result;
            }

            // Disposable email check
            if (this.isDisposableEmail(email)) {
                result.reason = 'Disposable email detected';
                return result;
            }

            // DNS MX record check
            // const mxRecords = await this.getCachedMxRecords(domain);
            // if (!mxRecords || mxRecords.length === 0) {
            //     result.reason = 'No MX records found';
            //     return result;
            // }

            result.valid = true;
            return result;

        } catch (error) {
            result.reason = `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return result;
        }
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            );
        }

        // Read file content
        const fileContent = await file.text();
        const emails = fileContent
            .split(/[\n,]/)
            .map(email => email.trim())
            .filter(Boolean);

        if (emails.length === 0) {
            return NextResponse.json(
                { error: 'No valid emails found in file' },
                { status: 400 }
            );
        }

        const validator = new EmailValidator();

        const results = await Promise.all(
            emails.map(email => validator.verify(email))
        );

        const summary: ValidationSummary = {
            total: results.length,
            valid: results.filter(r => r.valid).length,
            invalid: results.filter(r => !r.valid).length,
            validEmails: results.filter(r => r.valid),
            validEmailsList: results.filter(r => r.valid).map(data => ({email: data.email})),
            invalidEmails: results.filter(r => !r.valid),
            results
        };

        return NextResponse.json(summary);

    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An unknown error occurred' },
            { status: 500 }
        );
    }
}