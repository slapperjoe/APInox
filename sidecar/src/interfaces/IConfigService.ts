export interface IConfigService {
    get<T>(section: string, key: string, defaultValue?: T): T | undefined;
    set(key: string, value: any): Promise<void>;
    has(key: string): boolean;
    getProxyUrl(): string | undefined;
    getStrictSSL(): boolean | undefined;
}
