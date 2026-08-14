const activeCollections = new Map();

export async function getCollection(messageId) {
    return activeCollections.get(messageId);
}

export async function saveCollection(messageId, data) {
    activeCollections.set(messageId, data);
}

export async function updateDeposit(messageId, userId, amount) {
    const collection = activeCollections.get(messageId);
    if (!collection) return null;

    collection.deposits[userId] = (collection.deposits[userId] || 0) + amount;
    return collection;
}
