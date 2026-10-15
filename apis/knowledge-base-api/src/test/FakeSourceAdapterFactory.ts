import type { SourceAdapter } from '../sources/SourceAdapter.js';
import { FakeSourceAdapter } from './FakeSourceAdapter.js';

/** Stands in for `SourceAdapterFactory`: every knowledge base gets the same fake source. */
export class FakeSourceAdapterFactory {
    public readonly adapter = new FakeSourceAdapter();

    public get(): SourceAdapter {
        return this.adapter;
    }
}
