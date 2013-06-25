Feature: Create a document
  As a client of storra
  I want to create a document
  So that I can access it later

  Scenario: Create a new document
    Given an empty collection
    When I POST a document
    # Um, speaking of 201 and no content...
    # Shouldn't it be either 204 and no content or 201 plus content
    # (like, the created entity in the response body)?
    Then the http status should be 201
    And I should see no content
    When I GET the document
    Then the http status should be 200
    And I should see the document

  Scenario: Conflict while creating a document
    TODO 

#    When creating a document that has an _id delivered by the client (in the POST body JSON)
#    And there already exists a document with this _id
#    Then the http status should be 409
#    When I GET the document (again)
#    Then the content should still be the first existing document
#    (it must not have been overwritten by the second)
    
