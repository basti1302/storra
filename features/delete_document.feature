Feature: Delete a Document
  As a client of storra
  I want to delete a document
  So that its data is gone forever

  Scenario: Delete a document
    Given a collection with a document
    When I DELETE the document
    Then the http status should be 204
    And I should see no content
    When I GET the document
    Then the http status should be 404
    And I should see "The requested resource was not found."
