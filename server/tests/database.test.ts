import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createPrismaClient } from '../src/db.js';
import { PrismaPlaceRepository } from '../src/repositories/prisma-place-repository.js';

const prisma = createPrismaClient();
const repository = new PrismaPlaceRepository(prisma);

before(async () => {
  await prisma.$connect();
});

after(async () => {
  await prisma.$disconnect();
});

test('seed import keeps the address baseline and adds independent coordinate places', async () => {
  const [places, comments, images] = await Promise.all([
    prisma.place.count(),
    prisma.placeComment.count(),
    prisma.placeImage.count(),
  ]);
  assert.ok(places >= 664);
  assert.equal(comments, 1587);
  assert.equal(images, 964);

  const result = await repository.list({ offset: 0, limit: 20 });
  assert.ok(result.total >= 664);

  const mapItems = await repository.map({
    north: 31,
    south: 29,
    east: 115,
    west: 113,
    limit: 500,
  });
  assert.ok(mapItems.length >= 182);
  assert.equal(await repository.findById('does-not-exist'), null);
});
