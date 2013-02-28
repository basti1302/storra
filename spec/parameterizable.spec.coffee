describe "The suit", ->

  beforeEach ->
    console.log('non-parameterized#beforeEach')

  afterEach ->
    console.log('non-parameterized#afterEach')

  it "should execute specs in the non-parameterized part", ->
    console.log('spec in non-parameterized')
    expect(true).toBe(true)

  parameterized = (param) ->
    describe "The parameterized sub-suit (" + param + ")", ->
  
      beforeEach ->
        console.log('parameterized#beforeEach')
  
      afterEach ->
        console.log('parameterized#afterEach')
  
      it "should execute specs in the parameterized part", ->
        console.log('spec in parameterized')
        expect(true).toBe(true)
  
      it "should be parameterizable", ->
        console.log('parameter: ' + param)
        expect(param).toMatch(/[AB]/)
 
  parameterized('A')
  parameterized('B')
