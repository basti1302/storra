Feature: Root path feature
  As a client of storra
  I want to see some informational text at /
  So that I know that storra is up and running

  Scenario: GET request to /
    When I GET the root URI
    Then the http status should be 400
    And I should see "This is storra, the REST data store. Usage:"

  Scenario: OPTIONS request to /
    When I access the root URI with the OPTIONS verb
    Then the http status should be 200
    And I should see no content
