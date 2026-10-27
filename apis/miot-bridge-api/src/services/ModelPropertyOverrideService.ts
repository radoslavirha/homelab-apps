import { Injectable, Scope, ProviderScope } from '@tsed/di';
import { ModelPropertyOverride } from '../models/model-property-override/ModelPropertyOverride.js';
import { ModelPropertyOverrideMongoRepository } from '../storage/model-property-override-mongo/ModelPropertyOverrideMongoRepository.js';
import { MongoModelPropertyOverrideMapper } from '../mappers/MongoModelPropertyOverrideMapper.js';

/**
 * Model property override persistence, backed by MongoDB.
 * Bridges ModelPropertyOverrideMongoRepository (DTO level) with the domain model using MongoModelPropertyOverrideMapper.
 */
@Injectable()
@Scope(ProviderScope.SINGLETON)
export class ModelPropertyOverrideService {
    constructor(
        private readonly repository: ModelPropertyOverrideMongoRepository,
        private readonly mapper: MongoModelPropertyOverrideMapper
    ) {}

    public async getAll(): Promise<ModelPropertyOverride[]> {
        const dtos = await this.repository.findAll();
        return Promise.all(dtos.map(dto => this.mapper.mongoToModel(dto)));
    }

    public async getByModel(model: string): Promise<ModelPropertyOverride[]> {
        const dtos = await this.repository.findByModel(model);
        return Promise.all(dtos.map(dto => this.mapper.mongoToModel(dto)));
    }

    public async create(override: Omit<ModelPropertyOverride, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModelPropertyOverride> {
        const dto = await this.repository.create(await this.mapper.buildMongoCreate(override));
        return this.mapper.mongoToModel(dto);
    }

    public async delete(id: string): Promise<void> {
        await this.repository.deleteById(id);
    }
}
