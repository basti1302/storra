Feature: Delete a Collection
  As a client of storra
  I want to delete a collection
  So that I get rid of data I no longer need

  Scenario: Remove a collection
    Given a collection with documents
    When I DELETE the collection
    Then the http status should be 204
    When I GET the collection
    # 404 would be much better, but 200 is the status quo.
    Then the http status should be 200
    # "And I should see no content" would be much better, but...
    And I should see an empty list of documents
