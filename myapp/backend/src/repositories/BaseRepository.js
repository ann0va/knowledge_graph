// src/repositories/BaseRepository.js
class BaseRepository {
    constructor() {
        if (this.constructor === BaseRepository) {
            throw new Error('BaseRepository ist eine abstrakte Klasse');
        }
    }

    async create(data) {
        throw new Error('create() muss implementiert werden');
    }

    async read(query) {
        throw new Error('read() muss implementiert werden');
    }

    async update(id, data) {
        throw new Error('update() muss implementiert werden');
    }

    async delete(id) {
        throw new Error('delete() muss implementiert werden');
    }

    async executeQuery(query) {
        throw new Error('executeQuery() muss implementiert werden');
    }
}

module.exports = BaseRepository;