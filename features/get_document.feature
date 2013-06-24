Feature: Get a Document
  As a client of storra
  I want to get a single document
  So that I can use its data 

  Scenario: Retrieve a document of a non-existing collection 
    Given a non-existing collection
    And a non-existing document 
    When I GET the document
    Then the http status should be 404
    And I should see "The requested resource was not found."

  Scenario: Retrieve a non-existing document (in an existing collection)
    Given an empty collection
    And a non-existing document 
    When I GET the document
    Then the http status should be 404
    And I should see "The requested resource was not found."

 Scenario: Retrieve a document
    Given a collection with a document
    When I GET the document
    Then the http status should be 200
    And I should see the document
