Feature: Create a Collection on the Fly (Or Not)
  As a client of storra
  I want to create collections implicitly/on the fly in certain situations
  But I do not want them to be created on the fly when I would not expect it
  So that the behaviour of Storra does not surprise me

  Requests that may trigger the creation of a new collection on the fly:
  - creating a new document in a formerly non-existing collection - this also
  might create the collection on the fly. (POST /collection/key)
  (This is already tested in list_collection.feature#list a collection with
  documents, because the "Given a collection with documents" step does not
  create the collection explicitly beforehand.

  Requests that should not trigger the creation of a new collection include:
  - getting a document from a non-existing collection (GET /collection/key)
  - updating a document in a non-existing collection  (PUT /collection/key)
  - deleting a document in a non-existing collection  (DELETE /collection/key)

  Scenario: Do not create a collection on the fly when getting a document
    Given a non-existing collection
    And a non-existing document
    When I GET the document
    Then the http status should be 404
    When I GET the collection
    Then the http status should be 404

  Scenario: Do not create a collection on the fly when updating a document
    Given a non-existing collection
    And a non-existing document
    When I PUT the document
    Then the http status should be 404
    When I GET the collection
    Then the http status should be 404

  Scenario: Do not create a collection on the fly when deleting a document
    Given a non-existing collection
    And a non-existing document
    When I DELETE the document
    Then the http status should be 204
    When I GET the collection
    Then the http status should be 404

