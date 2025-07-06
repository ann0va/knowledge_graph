// src/components/query/shared/LabelTranslator.js - Zentrale deutsche Übersetzungen für alle UI-Labels

/**
 * Übersetzt Relationship-Typen ins Deutsche
 */
export const getRelationshipTypeLabel = (type) => {
    const labels = {
        'WORKS_IN': 'arbeitet in Bereich',
        'HAS_OCCUPATION': 'hat Beruf',
        'RECEIVED': 'erhielt Auszeichnung',
        'BIRTH_IN': 'wurde geboren in',
        'DIED_IN': 'starb in',
        'WORKED_AT': 'arbeitete bei',
        'CREATED': 'erschuf Werk',
        'STUDENT_OF': 'war Student von',
        'ADVISED': 'betreute',
        'PARTNER_OF': 'war Partner von',
        'RELATIVE_OF': 'ist verwandt mit',
        'INFLUENCED_BY': 'wurde beeinflusst von',
        'SIGNIFICANT_PERSON_FOR': 'war bedeutsam für',
        'FATHER_OF': 'ist Vater von',
        'MOTHER_OF': 'ist Mutter von',
        'NATIONAL_OF': 'ist Staatsangehöriger von'
    };
    return labels[type] || type;
};

/**
 * Übersetzt Entity-Typen ins Deutsche mit Icons
 */
export const getEntityTypeLabel = (type) => {
    const labels = {
        'person': '👤 Person',
        'place': '📍 Ort',
        'work': '📚 Werk',
        'award': '🏆 Auszeichnung',
        'field': '🔬 Fachbereich',
        'occupation': '💼 Beruf',
        'workplace': '🏢 Arbeitsplatz'
    };
    return labels[type] || type;
};

/**
 * Übersetzt Entity-Typen ins Deutsche ohne Icons (für Platzhalter)
 */
export const getEntityTypeSimple = (type) => {
    const labels = {
        'person': 'Person',
        'place': 'Ort',
        'work': 'Werk',
        'award': 'Auszeichnung',
        'field': 'Fachbereich',
        'occupation': 'Beruf',
        'workplace': 'Arbeitsplatz'
    };
    return labels[type] || type;
};

/**
 * Übersetzt Feld-Namen ins Deutsche
 */
export const getFieldLabel = (field) => {
    const labels = {
        'id': 'Wikidata-ID',
        'name': 'Name',
        'birth_date': 'Geburtsdatum',
        'death_date': 'Sterbedatum',
        'gender': 'Geschlecht',
        'description': 'Beschreibung',
        'type': 'Typ',
        'vertex_id': 'Vertex-ID',
        'target_name': 'Ziel-Name',
        'source_name': 'Quell-Name',
        'relationship_type': 'Beziehungstyp',
        'entity_type': 'Entity-Typ',
        'wikidata_id': 'Wikidata-ID'
    };
    return labels[field] || field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Übersetzt Datenbank-Namen ins Deutsche
 */
export const getDatabaseLabel = (database) => {
    const labels = {
        'memgraph': '🔵 Memgraph',
        'oracle': '🔴 Oracle',
        'both': '🔵🔴 Beide Datenbanken'
    };
    return labels[database] || database;
};






/**
 * Hilfsfunktion: Erstellt deutsche Platzhaltertexte
 */
export const getPlaceholderText = (entityType, action = 'auswählen') => {
    const simpleType = getEntityTypeSimple(entityType);
    return `${simpleType} ${action}...`;
};
