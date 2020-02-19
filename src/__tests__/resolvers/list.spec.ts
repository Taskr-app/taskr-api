import { gql } from 'apollo-server-express';
import faker from 'faker';
import {
  testServer,
  createTestDbConnection,
  closeTestDb
} from '../mocks/server';

import { createTestClient } from 'apollo-server-testing';
import { List } from '../../entity/List';
import { Connection } from 'typeorm';
const { mutate } = createTestClient(testServer);

describe('List Resolver', () => {
  let connection: Connection;
  beforeAll(async () => {
    connection = await createTestDbConnection();
  });

  afterAll(async () => {
    await closeTestDb(connection);
  });

  const mockList = {
    name: faker.commerce.product(),
    projectId: 1
  };

  const mockLists = ['backlog', 'todo', 'doing', 'done'];

  const lists: any[] = [];

  describe('createList mutation', () => {
    it('should create a list in the db', async () => {
      const createListMutationDocument = gql`
        mutation CreateList($name: String!, $projectId: ID!) {
          createList(name: $name, projectId: $projectId) {
            id
            name
          }
        }
      `;

      mockLists.forEach(async listName => {
        const createList = await mutate({
          mutation: createListMutationDocument,
          variables: {
            name: listName,
            projectId: 1
          }
        });
        if (!createList) throw new Error('Failed to create a list');
        lists.push(createList);
      });

      const list = await List.findOne({
        where: { id: lists[0].data!.createList.id }
      });

      expect(parseInt(lists[0].data.createList.id)).toEqual(list!.id);
      expect(lists[0].data).toBeDefined();
      expect(lists[0].errors).toBeUndefined();
    });
  });

  describe('updateList mutation', () => {
    it('should update name of list in the db', async () => {
      const updateListName = await mutate({
        mutation: gql`
          mutation UpdateListName($name: String!, $id: ID!) {
            updateListName(name: $name, id: $id)
          }
        `,
        variables: { name: mockList.name, id: lists[0].id }
      });

      expect(updateListName.data).toBeDefined();
      expect(updateListName.errors).toBeUndefined();
    });
  });

  describe('updateListPos mutation', () => {
    it('should update position of list in db', async () => {
      const updateListPos = await mutate({
        mutation: gql`
          mutation UpdateListPos($id: ID!, $aboveId: ID!, $belowId: ID!) {
            updateListPos(id: $id, aboveId: $aboveId, belowId: $belowId) {
              id
              name
              pos
            }
          }
        `,
        variables: {
          id: lists[0].id,
          aboveId: lists[1].id,
          belowId: lists[2].id
        }
      });

      expect(updateListPos.data).toBeDefined();
      expect(updateListPos.errors).toBeUndefined();
    });
  });
});
