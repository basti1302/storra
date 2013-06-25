Feature: Overwrite a document
  As a client of storra
  I want to overwrite an existing document with new data
  So that it is up to date

  Scenario: Overwrite an existing document
    Given a collection with a document
    When I PUT the document
    Then the http status should be 204
    And I should see no content
    # status 200 and the updated entity in the response body would also be appropriate.
    # What do we want? Do we want that to be configurable?

  Scenario: Trying to overwrite a non-existing document
    Given an empty collection
    And a non-existing document
    When I PUT the document
    Then the http status should be 404
    And I should see "The requested resource was not found."
