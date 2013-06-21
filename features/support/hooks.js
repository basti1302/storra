// Currently, this file is just a reminder:
// For propert test isolation, we need to either use a new collection for each
// run (with a uuid name, for example), or delete the collection before the test
// run...
//
// This is a copy from the ruby cucumber tests from the aboco project, of course
// it won't work in cucumber.js.
/*
Before do
  delete_database backend_url('audiobooks')
end

After do |scenario|
  if scenario.failed?
    save_page
  end
  delete_database backend_url('audiobooks')
end
*/
