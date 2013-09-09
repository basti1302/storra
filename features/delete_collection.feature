Feature: Delete a Collection
  As a client of storra
  I want to delete a collection
  So that I get rid of data I no longer need

  Scenario: Remove a collection
    Given a collection with documents
    When I DELETE the collection
    Then the http status should be 204
    When I GET the collection
    Then the http status should be 404
    And I should see "The requested resource was not found."
