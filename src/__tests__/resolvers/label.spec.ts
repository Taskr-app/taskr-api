import { createTestClient } from "apollo-server-testing";
import { gql } from "apollo-server-express";

import { testServer, createTestDb, closeTestDb } from "../mocks/server";
import { Connection } from "typeorm";
import faker from "faker";
import { Label } from "../../entity/Label";

const { query, mutate } = createTestClient(testServer);

describe("Label Resolver", () => {
  let connection: Connection;
  beforeAll(async () => {
    connection = await createTestDb();
  });
  afterAll(() => {
    closeTestDb(connection);
  });

  const mockLabel = {
    projectId: 1,
    name: faker.company.bsAdjective(),
    color: "#00ff00",
    newName: faker.company.bsAdjective(),
    newColor: "#0000ff"
  };

  describe("CRUD label", () => {
    let createdLabel: Label
    it(`should create a label with name ${mockLabel.name} and color ${mockLabel.color}`, async () => {
      const { data, errors } = await mutate({
        mutation: gql`
          mutation CreateLabel(
            $projectId: ID!
            $name: String!
            $color: HexColor!
          ) {
            createLabel(projectId: $projectId, name: $name, color: $color)
          }
        `,
        variables: {
          projectId: mockLabel.projectId,
          name: mockLabel.name,
          color: mockLabel.color
        }
      });

      const label = await Label.findOne({
        relations: ["project"],
        where: { name: mockLabel.name },
        order: { id: "DESC" }
      });

      console.log(label)

      expect(data).toBeDefined();
      expect(data!.createLabel).toBe(true);
      expect(label).toBeDefined();
      expect(label!.name).toBe(mockLabel.name)
      expect(label!.color).toBe(mockLabel.color)
      expect(errors).toBeUndefined();
      createdLabel = label!
    });

    it("should fetch all labels from a project", async () => {
      const { data, errors } = await query({
        query: gql`
          query GetProjectLabels($projectId: ID!) {
            getProjectLabels(projectId: $projectId) {
              id
              name
              color
            }
          }
        `,
        variables: {
          projectId: mockLabel.projectId
        }
      });

      expect(data).toBeDefined();
      expect(data!.getProjectLabels.length).toBeGreaterThanOrEqual(1);
      expect(data!.getProjectLabels).toContainEqual(
        expect.objectContaining({
          name: mockLabel.name,
          color: mockLabel.color
        })
      );
      expect(errors).toBeUndefined();
    });

    it("should update a label in a project", async () => {
      const { data, errors } = await mutate({
        mutation: gql`
          mutation updateLabel($id: ID!, $name: String, $color: HexColor) {
            updateLabel(id: $id, name: $name, color: $color)
          }
        `,
        variables: {
          id: createdLabel.id,
          name: mockLabel.newName,
          color: mockLabel.newColor
        }
      });

      expect(data).toBeDefined();
      expect(data!.updateLabel).toBe(true);
      expect(errors).toBeUndefined();
    });

    // it("should assign the label to a task from the same project", async () => {
    //   const { data, errors } = await mutate({
    //     mutation: gql`
    //       mutation AssignLabel($taskId: ID!, $labelId: ID!) {
    //         assignLabel(taskId:$taskId, labelId:$labelId)
    //       }
    //     `,
    //     variables: {
    //       taskId: ,
    //       labelId: createdLabel.id
    //     }
    //   })
    // })

    it("should delete a label from a project", async () => {
      const { data, errors } = await mutate({
        mutation: gql`
          mutation deleteLabel($id: ID!) {
            deleteLabel(id: $id)
          }
        `,
        variables: {
          id: createdLabel.id
        }
      });
      expect(data).toBeDefined();
      expect(data!.deleteLabel).toBe(true);
      expect(errors).toBeUndefined();
    });
  });
});
